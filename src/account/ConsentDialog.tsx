import { useEffect, useRef, useState } from 'react'
import { getConsent, onConsentChange, onOpenConsentDialog, setConsent } from './consent'
import { detectLanguage } from './language'
import { useConsent } from './useConsent'

/**
 * The consent question, the same in every game and on the front page.
 *
 * Centred, and it stays until it is answered: no close button, Escape or click
 * outside the first time. A strip at the bottom of the screen was easy to miss
 * or dismiss unread, and a "no" costs more than it looks — so the dialog says
 * what a "no" means BEFORE the choice, and lists what is stored in words a
 * player understands (no storage keys). Opened again from a settings menu
 * (openConsentDialog), there is already an answer, and it closes like any
 * dialog.
 *
 * After a "no", a small strip stays at the bottom saying progress is not being
 * saved, with a way to turn it on. One click hides it until the next page load;
 * remembering that it was hidden would itself be storage.
 *
 * Styling is inline plus one injected stylesheet, for the same reason as
 * AccountBadge: this file is vendored into repos with different Tailwind
 * versions and theme variables. It follows the system colour scheme.
 *
 * The text is built in, in Norwegian and English, because it is the same
 * question with the same answer everywhere — only the list of what a game
 * stores differs, and that comes in through `items`.
 */

export interface ConsentItem {
    no: { title: string; body: string }
    en: { title: string; body: string }
}

export interface ConsentDialogProps {
    /** 'no' or 'en'. Anything else, or nothing, is detected from the page. */
    language?: string
    /** The game's own name, for the opening line. Left out on the front page. */
    game?: string
    /**
     * What THIS game stores beyond the sign-in and the answer itself, in plain
     * words: "your progress in this game", "your chosen difficulty". Never a
     * storage key — a player cannot read those.
     */
    items?: ConsentItem[]
}

const TEXT = {
    no: {
        section: 'Personvern',
        title: 'Lagre fremgangen din på denne enheten?',
        lead: (game?: string) =>
            `${game ? `${game} og resten av SpillArena` : 'SpillArena'} lagrer noen få ting i nettleseren din, slik at du forblir innlogget og fremgangen din følger deg mellom spillene.`,
        scope: 'Svaret gjelder hele SpillArena – forsiden og alle spillene.',
        withoutTitle: 'Hvis du avslår:',
        without: [
            'Du blir ikke husket. Du må logge inn på nytt hver gang du åpner et spill eller laster siden på nytt.',
            'Spiller du uten å logge inn, forsvinner XP, nivåer og rekorder når du lukker fanen.',
            'Runder du spiller uten å være innlogget, havner ikke under navnet ditt på ledertavlene.',
            'Innstillingene dine nullstilles ved hvert besøk.',
        ],
        storedTitle: 'Dette lagres i nettleseren din',
        session: {
            title: 'Holder deg innlogget',
            body: 'Brukernavnet ditt og en innloggingsnøkkel som varer i opptil 30 dager, så du slipper å logge inn på nytt i hvert spill. PIN-koden din lagres aldri her.',
        },
        choice: {
            title: 'Svaret ditt på dette spørsmålet',
            body: 'Om du sa ja eller nei, så vi ikke spør igjen. Dette lagres også hvis du avslår.',
        },
        alwaysStored: 'Lagres alltid',
        server: 'Bare hvis du lager en konto, lagres dette også på serveren vår: brukernavnet ditt, en beskyttet utgave av PIN-koden som ingen kan lese, og fremgangen din i hvert spill.',
        noTracking: 'Ingen reklame, ingen sporing, og ingenting deles med tredjeparter.',
        accept: 'Godta og lagre',
        decline: 'Avslå',
        current: (accepted: boolean) => `Valget ditt nå: ${accepted ? 'godtatt' : 'avslått'}`,
        close: 'Lukk',
        reminder: 'Fremgangen din lagres ikke på denne enheten.',
        turnOn: 'Slå på',
        hideReminder: 'Skjul til neste besøk',
    },
    en: {
        section: 'Privacy',
        title: 'Save your progress on this device?',
        lead: (game?: string) =>
            `${game ? `${game} and the rest of SpillArena` : 'SpillArena'} stores a few small things in your browser so you stay signed in and your progress follows you between the games.`,
        scope: 'Your answer applies to all of SpillArena – the front page and every game.',
        withoutTitle: 'If you decline:',
        without: [
            "You aren't remembered. You have to sign in again every time you open a game or reload the page.",
            'If you play without signing in, your XP, levels and records are gone when you close the tab.',
            "Rounds you play while signed out aren't posted under your name on the leaderboards.",
            'Your settings reset on every visit.',
        ],
        storedTitle: 'What is stored in your browser',
        session: {
            title: 'Keeps you signed in',
            body: "Your username and a sign-in key that lasts up to 30 days, so you don't have to sign in again in every game. Your PIN is never stored here.",
        },
        choice: {
            title: 'Your answer to this question',
            body: "Whether you said yes or no, so we don't ask again. This is saved even if you decline.",
        },
        alwaysStored: 'Always stored',
        server: 'Only if you create an account, this is also saved on our server: your username, a protected version of your PIN that nobody can read, and your progress in each game.',
        noTracking: 'No ads, no tracking, and nothing is shared with third parties.',
        accept: 'Accept and save',
        decline: 'Decline',
        current: (accepted: boolean) => `Your current choice: ${accepted ? 'accepted' : 'declined'}`,
        close: 'Close',
        reminder: "Your progress isn't being saved on this device.",
        turnOn: 'Turn on',
        hideReminder: 'Hide until next visit',
    },
} as const

const STYLE_ID = 'spillarena-consent-style'

const CSS = `
.sac-overlay {
  position: fixed; inset: 0; z-index: 2147483100;
  display: flex; align-items: center; justify-content: center;
  padding: 12px; background: rgba(0, 0, 0, 0.55);
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
  animation: sac-fade 0.2s ease-out;
}
.sac-dialog {
  display: flex; flex-direction: column; width: 100%; max-width: 32rem; max-height: 100%;
  overflow: hidden; border-radius: 24px; border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fbfcf8; color: #20241d; outline: none;
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.55);
  font: 400 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  animation: sac-rise 0.22s ease-out;
  text-align: left;
}
.sac-dialog *, .sac-reminder * { box-sizing: border-box; }
/*
 * The host game's global styles reach in here — FleetBot uppercases every h2
 * and colours every p. Reset what they touch; the rules below that need a
 * different value are scoped under .sac-dialog so they still win.
 */
.sac-dialog h2, .sac-dialog h3, .sac-dialog p, .sac-dialog li, .sac-dialog span,
.sac-reminder span {
  color: inherit; text-transform: none; letter-spacing: normal; text-shadow: none;
  font-family: inherit; font-style: normal; text-align: left;
}
.sac-body { flex: 1; overflow-y: auto; padding: 22px 22px 18px; }
.sac-head { display: flex; align-items: flex-start; gap: 12px; }
.sac-icon {
  flex: none; width: 40px; height: 40px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(124, 58, 237, 0.14); color: #7c3aed;
}
.sac-dialog .sac-kicker { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.62; }
.sac-dialog .sac-title { margin: 2px 0 0; font: 600 21px/1.25 Georgia, "Iowan Old Style", "Palatino Linotype", serif; }
.sac-close {
  margin: -4px -4px 0 auto; flex: none; border: 0; background: transparent; color: inherit;
  width: 32px; height: 32px; border-radius: 999px; cursor: pointer; opacity: 0.6; font-size: 20px; line-height: 1;
}
.sac-close:hover { opacity: 1; background: rgba(0, 0, 0, 0.06); }
.sac-muted { opacity: 0.72; }
.sac-dialog .sac-lead { margin: 12px 0 0; font-size: 14px; }
.sac-dialog .sac-scope { margin: 6px 0 0; font-size: 12.5px; font-weight: 600; opacity: 0.72; }
.sac-warn { margin-top: 14px; padding: 12px 16px; border-radius: 16px; background: #fef3c7; color: #451a03; }
.sac-dialog .sac-warn__title { margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
/* explicit list style: the games' CSS resets (Tailwind preflight) remove it */
.sac-warn ul { margin: 8px 0 0; padding-left: 20px; display: grid; gap: 4px; font-size: 13.5px; line-height: 1.35; list-style: disc outside; }
.sac-warn li { display: list-item; list-style: disc outside; }
.sac-dialog li { font-size: inherit; }
.sac-dialog .sac-h3 { margin: 18px 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.62; }
.sac-items { margin: 0; padding: 0; list-style: none; display: grid; gap: 12px; }
.sac-item { display: flex; gap: 12px; }
.sac-dot {
  flex: none; margin-top: 2px; width: 28px; height: 28px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(0, 0, 0, 0.1); background: rgba(0, 0, 0, 0.03); opacity: 0.8;
}
.sac-dialog .sac-item__title { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-weight: 600; font-size: 14px; }
.sac-dialog .sac-item__body { margin: 1px 0 0; font-size: 12.5px; line-height: 1.35; opacity: 0.72; }
.sac-dialog .sac-chip {
  padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase; background: rgba(0, 0, 0, 0.06); opacity: 0.8;
}
.sac-dialog .sac-note { margin: 14px 0 0; font-size: 12.5px; line-height: 1.4; opacity: 0.72; }
.sac-foot { padding: 14px 22px 18px; border-top: 1px solid rgba(0, 0, 0, 0.1); }
.sac-dialog .sac-current { margin: 0 0 10px; font-size: 12.5px; opacity: 0.72; }
.sac-buttons { display: flex; flex-direction: column-reverse; gap: 8px; }
.sac-btn {
  flex: 1; padding: 11px 16px; border-radius: 12px; cursor: pointer;
  font: 600 14px/1.1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  transition: transform 0.15s ease, background-color 0.15s ease;
}
.sac-btn--no { border: 1px solid rgba(0, 0, 0, 0.16); background: transparent; color: inherit; }
.sac-btn--no:hover { background: rgba(0, 0, 0, 0.05); }
.sac-btn--yes { border: 0; background: #7c3aed; color: #fff; }
.sac-btn--yes:hover { transform: scale(1.02); }
.sac-btn:focus-visible, .sac-close:focus-visible, .sac-pill button:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }

.sac-reminder {
  position: fixed; left: 0; right: 0; bottom: 16px; z-index: 2147482900;
  display: flex; justify-content: center; padding: 0 16px; pointer-events: none;
  animation: sac-rise 0.25s ease-out;
}
.sac-pill {
  pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: 100%;
  padding: 6px 6px 6px 14px; border-radius: 999px; border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(251, 252, 248, 0.95); color: #20241d;
  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.35);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  font: 500 13.5px/1.25 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.sac-pill__warn { color: #b45309; flex: none; }
.sac-pill__on {
  flex: none; border: 0; border-radius: 999px; padding: 5px 12px; cursor: pointer;
  background: #7c3aed; color: #fff; font: 700 12px/1 inherit;
}
.sac-pill__x {
  flex: none; border: 0; background: transparent; color: inherit; cursor: pointer;
  width: 26px; height: 26px; border-radius: 999px; opacity: 0.6; font-size: 16px; line-height: 1;
}
.sac-pill__x:hover { opacity: 1; background: rgba(0, 0, 0, 0.06); }

/* over the account badge, which sits in a bottom corner in most games */
@media (max-width: 639px) { .sac-reminder { bottom: 64px; } }
@media (min-width: 640px) {
  .sac-overlay { padding: 24px; }
  .sac-body { padding: 28px 28px 20px; }
  .sac-foot { padding: 16px 28px 20px; }
  .sac-title { font-size: 24px; }
  .sac-buttons { flex-direction: row; }
}
@media (prefers-color-scheme: dark) {
  .sac-dialog { background: #1d1e17; color: #edefe4; border-color: rgba(255, 255, 255, 0.12); }
  .sac-icon { background: rgba(167, 139, 250, 0.18); color: #c4b5fd; }
  .sac-close:hover, .sac-pill__x:hover { background: rgba(255, 255, 255, 0.08); }
  .sac-warn { background: rgba(120, 53, 15, 0.45); color: #fffbeb; }
  .sac-dot { border-color: rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.04); }
  .sac-dialog .sac-chip { background: rgba(255, 255, 255, 0.08); }
  .sac-foot { border-top-color: rgba(255, 255, 255, 0.12); }
  .sac-btn--no { border-color: rgba(255, 255, 255, 0.18); }
  .sac-btn--no:hover { background: rgba(255, 255, 255, 0.06); }
  /* the dark-mode accent is a light shade; white on it is hard to read */
  .sac-btn--yes, .sac-pill__on { background: #a78bfa; color: #14140f; }
  .sac-pill { background: rgba(29, 30, 23, 0.94); color: #edefe4; border-color: rgba(255, 255, 255, 0.14); }
  .sac-pill__warn { color: #fbbf24; }
}
@media (prefers-reduced-motion: reduce) {
  .sac-overlay, .sac-dialog, .sac-reminder { animation: none; }
  .sac-btn { transition: none; }
}
@keyframes sac-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sac-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
`

function useInjectedStyle(): void {
    useEffect(() => {
        if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
        const tag = document.createElement('style')
        tag.id = STYLE_ID
        tag.textContent = CSS
        document.head.appendChild(tag)
    }, [])
}

const WarnIcon = ({ className }: { className?: string }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
    </svg>
)

const svg = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

const KeyIcon = () => (
    <svg {...svg}>
        <circle cx="7.5" cy="15.5" r="4.5" />
        <path d="m21 2-9.6 9.6" />
        <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
)

const BoxIcon = () => (
    <svg {...svg}>
        <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
        <path d="M3 8l9 5 9-5" />
        <path d="M12 13v8" />
    </svg>
)

const CheckIcon = () => (
    <svg {...svg}>
        <path d="M20 6 9 17l-5-5" />
    </svg>
)

const CookieIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
        <path d="M8.5 8.5v.01" />
        <path d="M16 15.5v.01" />
        <path d="M12 12v.01" />
        <path d="M11 17v.01" />
        <path d="M7 14v.01" />
    </svg>
)

export function ConsentDialog({ language, game, items = [] }: ConsentDialogProps) {
    useInjectedStyle()
    const text = TEXT[detectLanguage(language)]
    const consent = useConsent()
    const [open, setOpen] = useState<boolean>(() => getConsent() === null)
    const [reminderHidden, setReminderHidden] = useState(false)
    const dialogRef = useRef<HTMLDivElement>(null)
    const dismissible = consent !== null

    useEffect(() => onOpenConsentDialog(() => setOpen(true)), [])

    // answered elsewhere — the front page, or another game in another tab
    useEffect(
        () =>
            onConsentChange((status) => {
                if (status !== null) setOpen(false)
            }),
        [],
    )

    useEffect(() => {
        if (!open) return
        const previousOverflow = document.body.style.overflow
        const previousFocus = document.activeElement as HTMLElement | null
        document.body.style.overflow = 'hidden'
        const frame = requestAnimationFrame(() => dialogRef.current?.focus())

        // focus stays inside: the page behind is covered, and Tab should not reach it
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (getConsent() !== null) {
                    event.stopPropagation()
                    setOpen(false)
                }
                return
            }
            const dialog = dialogRef.current
            if (event.key !== 'Tab' || !dialog) return
            const focusable = dialog.querySelectorAll<HTMLElement>('button:not([disabled])')
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const active = document.activeElement
            if (event.shiftKey && (active === first || active === dialog)) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && active === last) {
                event.preventDefault()
                first.focus()
            }
        }
        window.addEventListener('keydown', onKeyDown, true)

        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener('keydown', onKeyDown, true)
            document.body.style.overflow = previousOverflow
            previousFocus?.focus?.()
        }
    }, [open])

    const answer = (status: 'accepted' | 'declined') => {
        setConsent(status)
        setOpen(false)
    }

    const lang = detectLanguage(language)
    const stored = [
        { key: 'session', icon: <KeyIcon />, ...text.session, always: false },
        ...items.map((item, index) => ({ key: `game-${index}`, icon: <BoxIcon />, ...item[lang], always: false })),
        { key: 'choice', icon: <CheckIcon />, ...text.choice, always: true },
    ]

    return (
        <>
            {open && (
                <div className="sac-overlay" onClick={() => dismissible && setOpen(false)}>
                    <div
                        ref={dialogRef}
                        className="sac-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sac-title"
                        aria-describedby="sac-lead"
                        tabIndex={-1}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="sac-body">
                            <div className="sac-head">
                                <span className="sac-icon">
                                    <CookieIcon />
                                </span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <p className="sac-kicker">{text.section}</p>
                                    <h2 id="sac-title" className="sac-title">
                                        {text.title}
                                    </h2>
                                </div>
                                {dismissible && (
                                    <button type="button" className="sac-close" aria-label={text.close} onClick={() => setOpen(false)}>
                                        ×
                                    </button>
                                )}
                            </div>

                            <p id="sac-lead" className="sac-lead sac-muted">
                                {text.lead(game)}
                            </p>
                            <p className="sac-scope">{text.scope}</p>

                            <div className="sac-warn">
                                <p className="sac-warn__title">
                                    <WarnIcon />
                                    {text.withoutTitle}
                                </p>
                                <ul>
                                    {text.without.map((line) => (
                                        <li key={line}>{line}</li>
                                    ))}
                                </ul>
                            </div>

                            <h3 className="sac-h3">{text.storedTitle}</h3>
                            <ul className="sac-items">
                                {stored.map((item) => (
                                    <li key={item.key} className="sac-item">
                                        <span className="sac-dot" aria-hidden="true">
                                            {item.icon}
                                        </span>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <p className="sac-item__title">
                                                {item.title}
                                                {item.always && <span className="sac-chip">{text.alwaysStored}</span>}
                                            </p>
                                            <p className="sac-item__body">{item.body}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <p className="sac-note">☁ {text.server}</p>
                            <p className="sac-note" style={{ marginTop: 6, fontWeight: 600 }}>
                                {text.noTracking}
                            </p>
                        </div>

                        <div className="sac-foot">
                            {dismissible && <p className="sac-current">{text.current(consent === 'accepted')}</p>}
                            <div className="sac-buttons">
                                <button type="button" className="sac-btn sac-btn--no" onClick={() => answer('declined')}>
                                    {text.decline}
                                </button>
                                <button type="button" className="sac-btn sac-btn--yes" onClick={() => answer('accepted')}>
                                    {text.accept}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {consent === 'declined' && !open && !reminderHidden && (
                <div className="sac-reminder" role="status">
                    <div className="sac-pill">
                        <WarnIcon className="sac-pill__warn" />
                        <span style={{ minWidth: 0 }}>{text.reminder}</span>
                        <button type="button" className="sac-pill__on" onClick={() => setOpen(true)}>
                            {text.turnOn}
                        </button>
                        <button
                            type="button"
                            className="sac-pill__x"
                            aria-label={text.hideReminder}
                            title={text.hideReminder}
                            onClick={() => setReminderHidden(true)}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}

export default ConsentDialog
