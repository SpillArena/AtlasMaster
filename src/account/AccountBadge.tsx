import { useEffect, useRef, useState } from 'react'
import { authenticate } from './api'
import { getSession, onSessionChange, signOut } from './session'
import { levelProgress } from './progress'
import { openConsentDialog } from './consent'
import { detectLanguage } from './language'
import { useConsent } from './useConsent'
import type { AuthAction, AuthErrorCode } from './types'

/**
 * The account, in the corner of every game.
 *
 * One account covers the whole domain, but a player moving from the front page
 * into a game has no way of knowing that unless something says so. This is that
 * something: small, always in the same place, and the same in all five games.
 *
 * IT USED TO BE A LINK, and deliberately so — the argument was that signing in
 * happens on spillarena.no once, and that a second login form inside a game
 * would suggest otherwise. That argument was about where the account LIVES,
 * and it is still true: this form posts to the same /api/auth on the front
 * page, stores the same session under the same key, and every other tab hears
 * about it. What the argument got wrong was the cost. A signed-out player who
 * had just finished a round was sent to another page to type a PIN, and came
 * back to a game that had moved on without them. Sending someone away to fix a
 * thirty-second problem is not simplicity.
 *
 * So the badge opens a panel instead. Signed out it takes a name and a PIN;
 * signed in it shows the level, a link to the full profile, and a way out.
 *
 * Styling is inline plus one injected stylesheet, deliberately: this file is
 * vendored into five repos that disagree about Tailwind versions and theme
 * variables, and a badge that renders correctly everywhere is worth more than
 * one that inherits perfectly in the one repo it was written for. For the same
 * reason every string is a prop — the games translate, this file cannot.
 */

/** Seconds as something a person would say, for the lockout message. */
function formatWait(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds`
    const minutes = Math.ceil(seconds / 60)
    return minutes === 1 ? 'a minute' : `${minutes} minutes`
}

const STYLE_ID = 'spillarena-account-badge-style'

/*
 * Colours follow the system theme rather than the game's own.
 *
 * Every game here has its own theme switcher, and none of them agree on how it
 * is stored, so a badge that tried to follow the game would be wrong in four
 * places. Following the OS is at least honestly wrong in a way that still
 * reads: light text on a dark pill, or the reverse.
 */
const CSS = `
.sa-root { position: fixed; z-index: 2147483000; }
.sa-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.82);
  color: #1e293b;
  font: 500 12px/1.2 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  text-decoration: none;
  letter-spacing: 0.01em;
  box-shadow: 0 6px 20px -8px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
  max-width: min(72vw, 320px);
  cursor: pointer;
}
.sa-badge:hover { transform: translateY(-1px); box-shadow: 0 10px 26px -8px rgba(0, 0, 0, 0.5); }
.sa-badge:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }
.sa-badge__name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-badge__muted { opacity: 0.66; }
.sa-badge__level {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 7px; border-radius: 999px;
  background: rgba(139, 92, 246, 0.16); color: #6d28d9; font-weight: 700; font-size: 11px;
}
.sa-badge__bar { width: 34px; height: 4px; border-radius: 999px; background: rgba(109, 40, 217, 0.22); overflow: hidden; }
.sa-badge__fill { height: 100%; border-radius: 999px; background: #7c3aed; }
.sa-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex: none; }
.sa-badge__dot--out { background: #94a3b8; }
.sa-badge__chev { opacity: 0.5; font-size: 9px; }

.sa-panel {
  position: absolute;
  text-align: left;
  width: min(84vw, 268px);
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.97);
  color: #1e293b;
  font: 400 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  box-shadow: 0 18px 44px -12px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.sa-panel__tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 2px; border-radius: 999px; background: rgba(15, 23, 42, 0.07); margin-bottom: 11px; }
.sa-panel__tab {
  border: 0; background: transparent; border-radius: 999px; padding: 6px 4px; cursor: pointer;
  font: 600 12px/1 inherit; color: inherit; opacity: 0.6;
}
.sa-panel__tab[aria-selected="true"] { background: #fff; opacity: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.16); }
.sa-panel__label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.6; margin-bottom: 4px; }
.sa-panel__input {
  width: 100%; box-sizing: border-box; padding: 8px 10px; margin-bottom: 9px;
  border-radius: 9px; border: 1px solid rgba(0,0,0,0.16); background: #fff; color: inherit;
  font: 400 13px/1.3 inherit;
}
.sa-panel__input:focus { outline: 2px solid #8b5cf6; outline-offset: 1px; border-color: transparent; }
.sa-panel__submit {
  width: 100%; padding: 9px; border: 0; border-radius: 9px; cursor: pointer;
  background: #7c3aed; color: #fff; font: 700 13px/1 inherit;
}
.sa-panel__submit:disabled { opacity: 0.55; cursor: progress; }
.sa-panel__error { margin: 0 0 9px; color: #b91c1c; font-size: 12px; font-weight: 600; }
.sa-panel__hint { margin: 10px 0 0; font-size: 11.5px; opacity: 0.66; }
.sa-panel__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sa-panel__who { font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-panel__link { color: inherit; opacity: 0.7; font-size: 12px; text-underline-offset: 2px; }
.sa-panel__signout {
  margin-top: 11px; width: 100%; padding: 8px; cursor: pointer;
  border-radius: 9px; border: 1px solid rgba(0,0,0,0.16); background: transparent; color: inherit;
  font: 600 12px/1 inherit;
}
.sa-panel__storage {
  margin: 0 0 10px; padding: 8px 10px; border-radius: 9px;
  background: #fef3c7; color: #451a03; font-size: 11.5px; line-height: 1.35;
}
.sa-panel__storage button {
  display: block; margin-top: 4px; padding: 0; border: 0; background: none; cursor: pointer;
  color: inherit; font: 700 11.5px/1.3 inherit; text-decoration: underline; text-underline-offset: 2px;
}
.sa-panel__meter { margin: 10px 0 2px; height: 6px; border-radius: 999px; background: rgba(109, 40, 217, 0.18); overflow: hidden; }
.sa-panel__meterfill { height: 100%; border-radius: 999px; background: #7c3aed; }

@media (prefers-color-scheme: dark) {
  .sa-badge {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(15, 23, 42, 0.78);
    color: #e2e8f0;
  }
  .sa-badge__level { background: rgba(167, 139, 250, 0.2); color: #c4b5fd; }
  .sa-badge__bar { background: rgba(196, 181, 253, 0.25); }
  .sa-badge__fill { background: #a78bfa; }
  .sa-panel { border-color: rgba(255,255,255,0.14); background: rgba(15, 23, 42, 0.97); color: #e2e8f0; }
  .sa-panel__tabs { background: rgba(255,255,255,0.08); }
  .sa-panel__tab[aria-selected="true"] { background: rgba(255,255,255,0.16); box-shadow: none; }
  .sa-panel__input { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.16); }
  .sa-panel__submit { background: #8b5cf6; }
  .sa-panel__error { color: #fca5a5; }
  .sa-panel__signout { border-color: rgba(255,255,255,0.18); }
  .sa-panel__storage { background: rgba(120, 53, 15, 0.45); color: #fffbeb; }
}
@media (max-width: 480px) { .sa-badge { font-size: 11px; padding: 6px 10px; } }
@media (prefers-reduced-motion: reduce) { .sa-badge { transition: none; } }
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

const CORNERS = {
    'bottom-right': { bottom: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
    'top-right': { top: 16, right: 16 },
    'top-left': { top: 16, left: 16 },
} as const

/** The panel opens away from whichever edge the badge sits on. */
const PANEL_POSITION = {
    'bottom-right': { bottom: 'calc(100% + 10px)', right: 0 },
    'bottom-left': { bottom: 'calc(100% + 10px)', left: 0 },
    'top-right': { top: 'calc(100% + 10px)', right: 0 },
    'top-left': { top: 'calc(100% + 10px)', left: 0 },
} as const

export interface AccountBadgeLabels {
    signedOut: string
    /** Given a username, the signed-in text. */
    signedInAs: (username: string) => string
    signIn: string
    register: string
    username: string
    pin: string
    /** Shown only while registering. */
    confirmPin: string
    /** Shown when the two PINs differ. Not a server code — nothing was sent. */
    pinMismatch: string
    submitSignIn: string
    submitRegister: string
    working: string
    signOut: string
    profile: string
    /** Why signing in is worth it, shown under the form. */
    guestHint: string
    level: (level: number) => string
    /**
     * Shown in the panel while the player has declined storage (consent.ts):
     * signing in works, but only until the tab closes. Defaults follow the
     * page language, since most games do not pass labels at all.
     */
    notRemembered: string
    /** The button under `notRemembered`, which opens the consent dialog. */
    turnOnSaving: string
    /**
     * Maps a stable error code to a sentence the player can read.
     *
     * `action` is passed because the same code deserves different advice
     * depending on what was being attempted: `name_taken` while registering
     * means "sign in instead", and `bad_credentials` while signing in means
     * "or make an account". `retryAfter` is seconds, and only arrives with
     * `locked`.
     */
    error: (code: AuthErrorCode, action: AuthAction, retryAfter?: number) => string
}

/** Seconds as a Norwegian would say them. */
function formatWaitNo(seconds: number): string {
    if (seconds < 60) return `${seconds} sekunder`
    const minutes = Math.ceil(seconds / 60)
    return minutes === 1 ? 'ett minutt' : `${minutes} minutter`
}

const DEFAULT_LABELS: AccountBadgeLabels = {
    signedOut: 'Not signed in',
    signedInAs: (username) => `Logged in as ${username}`,
    signIn: 'Sign in',
    register: 'New account',
    username: 'Name',
    pin: 'PIN',
    confirmPin: 'Repeat PIN',
    pinMismatch: 'The two PINs are not the same.',
    submitSignIn: 'Sign in',
    submitRegister: 'Create account',
    working: 'Working…',
    signOut: 'Sign out',
    profile: 'Profile on spillarena.no',
    guestHint: 'You can play without an account. Signing in saves your scores to the leaderboard.',
    level: (level) => `Lv ${level}`,
    notRemembered:
        "Storage is off. You stay signed in until you close this tab, and your progress and results are saved to your account until then. Next time you'll need to sign in again.",
    turnOnSaving: 'Turn on saving',
    error: (code, action, retryAfter) => {
        switch (code) {
            /*
             * Deliberately the same answer for "no such name" and "wrong PIN".
             * Told apart, the sign-in form becomes a way to ask which names
             * exist. What CAN be added without leaking anything is the way out
             * for the commonest cause: there is no account yet.
             */
            case 'bad_credentials':
                return 'Wrong name or PIN. If you have not made an account yet, use New account.'
            case 'username_empty':
                return 'Type a name first.'
            case 'username_too_long':
                return 'That name is too long — 20 characters at most.'
            case 'username_chars':
                return "Names can use letters, numbers, spaces and . _ ' - only."
            case 'name_reserved':
                return 'That name is reserved. Pick another one.'
            case 'name_not_allowed':
                return 'That name is not allowed. Pick another one.'
            case 'bad_username':
                return 'That name cannot be used.'
            case 'bad_pin':
                return 'The PIN must be 4–6 digits.'
            case 'name_taken':
                return 'That name is taken. If it is yours, sign in instead.'
            case 'banned':
                return 'This account is banned.'
            case 'locked':
                return retryAfter && retryAfter > 0
                    ? `Too many wrong attempts. Try again in ${formatWait(retryAfter)}.`
                    : 'Too many wrong attempts. Try again in a few minutes.'
            case 'not_configured':
                return 'Accounts are unavailable right now. You can keep playing as a guest.'
            case 'unreachable':
                return 'No answer from the account service. Check your connection and try again.'
            case 'unauthorized':
                return 'That session has expired. Sign in again.'
            default:
                return action === 'register'
                    ? 'Could not create the account. Try again.'
                    : 'Could not sign in. Try again.'
        }
    },
}

/*
 * The same labels in Norwegian. Most games pass no labels at all, and the site
 * is Norwegian: a Norwegian game showing an English sign-in form in its corner
 * looked like a different product. Chosen by `language`, or detected.
 */
const NORWEGIAN_LABELS: AccountBadgeLabels = {
    signedOut: 'Ikke logget inn',
    signedInAs: (username) => `Logget inn som ${username}`,
    signIn: 'Logg inn',
    register: 'Ny konto',
    username: 'Navn',
    pin: 'PIN',
    confirmPin: 'Gjenta PIN',
    pinMismatch: 'De to PIN-kodene er ikke like.',
    submitSignIn: 'Logg inn',
    submitRegister: 'Lag konto',
    working: 'Jobber …',
    signOut: 'Logg ut',
    profile: 'Profil på spillarena.no',
    guestHint: 'Du kan spille uten konto. Logger du inn, lagres resultatene dine på ledertavla.',
    level: (level) => `Nv ${level}`,
    notRemembered:
        'Lagring er slått av. Du er innlogget til du lukker fanen, og fremgang og resultater lagres på kontoen din så lenge. Neste gang må du logge inn igjen.',
    turnOnSaving: 'Slå på lagring',
    error: (code, action, retryAfter) => {
        switch (code) {
            case 'bad_credentials':
                return 'Feil navn eller PIN. Har du ikke laget konto ennå, velg Ny konto.'
            case 'username_empty':
                return 'Skriv inn et navn først.'
            case 'username_too_long':
                return 'Navnet er for langt – høyst 20 tegn.'
            case 'username_chars':
                return "Navn kan bare ha bokstaver, tall, mellomrom og . _ ' -"
            case 'name_reserved':
                return 'Det navnet er reservert. Velg et annet.'
            case 'name_not_allowed':
                return 'Det navnet er ikke tillatt. Velg et annet.'
            case 'bad_username':
                return 'Det navnet kan ikke brukes.'
            case 'bad_pin':
                return 'PIN-koden må være 4–6 siffer.'
            case 'name_taken':
                return 'Navnet er opptatt. Er det ditt, logg inn i stedet.'
            case 'banned':
                return 'Denne kontoen er utestengt.'
            case 'locked':
                return retryAfter && retryAfter > 0
                    ? `For mange feil forsøk. Prøv igjen om ${formatWaitNo(retryAfter)}.`
                    : 'For mange feil forsøk. Prøv igjen om noen minutter.'
            case 'not_configured':
                return 'Kontoer er ikke tilgjengelige akkurat nå. Du kan spille videre som gjest.'
            case 'unreachable':
                return 'Fikk ikke svar fra kontotjenesten. Sjekk nettet og prøv igjen.'
            case 'unauthorized':
                return 'Innloggingen har gått ut. Logg inn på nytt.'
            default:
                return action === 'register'
                    ? 'Kunne ikke lage kontoen. Prøv igjen.'
                    : 'Kunne ikke logge inn. Prøv igjen.'
        }
    },
}

export interface AccountBadgeProps {
    /**
     * Anything carrying an XP total — every game's profile qualifies, including
     * AtlasMaster's own richer one, which predates the shared engine. Left out,
     * the badge shows only the name.
     */
    progress?: { xp: number } | null
    corner?: keyof typeof CORNERS
    /** Where the full profile lives. The front page, unless a game says otherwise. */
    homeUrl?: string
    /** Overrides for any label. Anything omitted falls back to `language`. */
    labels?: Partial<AccountBadgeLabels>
    /**
     * 'no' or 'en' for the built-in labels. Left out, it is detected from the
     * page (`<html lang>`, then the browser). Games with a language switch pass
     * their current language, since not all of them keep `<html lang>` in step.
     */
    language?: string
    /** Called after a successful sign-in, so the game can pull its profile. */
    onSignedIn?: (username: string) => void
    /**
     * @deprecated Pass `labels.signedOut`.
     * Kept because this file is vendored into five repos that update at
     * different times, and a badge that throws in the one that lagged is worse
     * than a deprecated prop.
     */
    signedOutLabel?: string
    /** @deprecated Pass `labels.signedInAs`. */
    signedInLabel?: (username: string) => string
}

export function AccountBadge({
    progress = null,
    corner = 'bottom-right',
    homeUrl = 'https://spillarena.no',
    labels: overrides,
    language: requestedLanguage,
    onSignedIn,
    signedOutLabel,
    signedInLabel,
}: AccountBadgeProps) {
    useInjectedStyle()

    // the deprecated props lose to `labels` when a caller passes both
    const base = detectLanguage(requestedLanguage) === 'no' ? NORWEGIAN_LABELS : DEFAULT_LABELS
    const labels: AccountBadgeLabels = {
        ...base,
        ...(signedOutLabel ? { signedOut: signedOutLabel } : {}),
        ...(signedInLabel ? { signedInAs: signedInLabel } : {}),
        ...overrides,
    }

    const [username, setUsername] = useState<string | null>(() => getSession()?.username ?? null)
    const consent = useConsent()
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<AuthAction>('login')
    const [name, setName] = useState('')
    const [pin, setPin] = useState('')
    const [confirm, setConfirm] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<AuthErrorCode | null>(null)
    /** Seconds left on a lockout, when the service told us. */
    const [retryAfter, setRetryAfter] = useState<number | undefined>(undefined)
    /*
     * Kept apart from `error` because it is not a server code and nothing was
     * sent: the request is never made when the two PINs differ. Folding it into
     * AuthErrorCode would put a client-only value into a type that describes
     * what the account service can answer.
     */
    const [mismatch, setMismatch] = useState(false)

    const rootRef = useRef<HTMLDivElement>(null)

    // signing in happens on the front page too, which is very often another tab
    // in the same browser — without this the game would keep saying "not signed
    // in" until it was reloaded
    useEffect(() => onSessionChange((session) => setUsername(session?.username ?? null)), [])

    /*
     * Close on Escape or a click elsewhere.
     *
     * Both listeners only exist while the panel is open. A badge that is shut
     * is present on every screen of every game, and it has no business holding
     * document-level handlers for all of that time.
     */
    useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        const onClick = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onClick)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('mousedown', onClick)
        }
    }, [open])

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (busy) return

        /*
         * A new PIN is confirmed before anything is sent.
         *
         * Registering with a typo makes an account nobody can get into — the
         * PIN is never shown back, there is no email to reset it with, and the
         * name is taken from then on. Signing in has no such trap: a wrong PIN
         * just fails and can be retried, so the second field would only be in
         * the way there.
         */
        if (mode === 'register' && pin !== confirm) {
            setMismatch(true)
            setError(null)
            setConfirm('')
            return
        }

        setBusy(true)
        setError(null)
        setMismatch(false)
        setRetryAfter(undefined)
        const result = await authenticate(mode, name, pin)
        setBusy(false)
        // the PIN is never kept around, whether it worked or not
        setPin('')
        setConfirm('')
        if (!result.ok) {
            setError(result.error)
            setRetryAfter(result.retryAfter)
            return
        }
        setName('')
        setOpen(false)
        onSignedIn?.(result.session.username)
    }

    const switchMode = (next: AuthAction) => {
        setMode(next)
        setError(null)
        setRetryAfter(undefined)
        setMismatch(false)
        setConfirm('')
    }

    const level = progress ? levelProgress(progress.xp) : null
    const title = username ? labels.signedInAs(username) : labels.signedOut

    return (
        <div className="sa-root" style={CORNERS[corner]} ref={rootRef}>
            {open && (
                <div
                    className="sa-panel"
                    style={PANEL_POSITION[corner]}
                    role="dialog"
                    aria-label={title}
                >
                    {username ? (
                        <>
                            <div className="sa-panel__row">
                                <span className="sa-panel__who">{username}</span>
                                <a className="sa-panel__link" href={homeUrl}>
                                    {labels.profile}
                                </a>
                            </div>
                            {level && (
                                <>
                                    <div className="sa-panel__meter">
                                        <div
                                            className="sa-panel__meterfill"
                                            style={{ width: `${level.pct}%` }}
                                        />
                                    </div>
                                    <p className="sa-panel__hint">
                                        {labels.level(level.level)} · {level.pct}%
                                    </p>
                                </>
                            )}
                            {consent !== 'accepted' && (
                                <div className="sa-panel__storage">
                                    {labels.notRemembered}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOpen(false)
                                            openConsentDialog()
                                        }}
                                    >
                                        {labels.turnOnSaving}
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                className="sa-panel__signout"
                                onClick={() => {
                                    signOut()
                                    setOpen(false)
                                }}
                            >
                                {labels.signOut}
                            </button>
                        </>
                    ) : (
                        <form onSubmit={submit}>
                            <div className="sa-panel__tabs" role="tablist">
                                <button
                                    type="button"
                                    role="tab"
                                    className="sa-panel__tab"
                                    aria-selected={mode === 'login'}
                                    onClick={() => switchMode('login')}
                                >
                                    {labels.signIn}
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    className="sa-panel__tab"
                                    aria-selected={mode === 'register'}
                                    onClick={() => switchMode('register')}
                                >
                                    {labels.register}
                                </button>
                            </div>

                            <label className="sa-panel__label" htmlFor="sa-name">
                                {labels.username}
                            </label>
                            <input
                                id="sa-name"
                                className="sa-panel__input"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                autoComplete="username"
                                maxLength={24}
                                autoFocus
                            />

                            <label className="sa-panel__label" htmlFor="sa-pin">
                                {labels.pin}
                            </label>
                            <input
                                id="sa-pin"
                                className="sa-panel__input"
                                value={pin}
                                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                                /*
                                 * A PIN is digits, so the phone keyboard should be
                                 * digits. `inputMode` rather than type="number",
                                 * which brings spinners and drops leading zeros.
                                 */
                                inputMode="numeric"
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                type="password"
                                maxLength={6}
                            />

                            {mode === 'register' && (
                                <>
                                    <label className="sa-panel__label" htmlFor="sa-pin2">
                                        {labels.confirmPin}
                                    </label>
                                    <input
                                        id="sa-pin2"
                                        className="sa-panel__input"
                                        value={confirm}
                                        onChange={(event) => {
                                            setConfirm(event.target.value.replace(/\D/g, ''))
                                            setMismatch(false)
                                        }}
                                        inputMode="numeric"
                                        autoComplete="new-password"
                                        type="password"
                                        maxLength={6}
                                    />
                                </>
                            )}

                            {consent !== 'accepted' && (
                                <div className="sa-panel__storage">
                                    {labels.notRemembered}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOpen(false)
                                            openConsentDialog()
                                        }}
                                    >
                                        {labels.turnOnSaving}
                                    </button>
                                </div>
                            )}

                            {(error || mismatch) && (
                                <p className="sa-panel__error" role="alert">
                                    {mismatch
                                        ? labels.pinMismatch
                                        : labels.error(error!, mode, retryAfter)}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="sa-panel__submit"
                                disabled={
                                    busy ||
                                    name.trim().length === 0 ||
                                    pin.length < 4 ||
                                    (mode === 'register' && confirm.length < 4)
                                }
                            >
                                {busy
                                    ? labels.working
                                    : mode === 'login'
                                      ? labels.submitSignIn
                                      : labels.submitRegister}
                            </button>

                            <p className="sa-panel__hint">{labels.guestHint}</p>
                        </form>
                    )}
                </div>
            )}

            <button
                type="button"
                className="sa-badge"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="dialog"
                title={title}
            >
                <span
                    className={username ? 'sa-badge__dot' : 'sa-badge__dot sa-badge__dot--out'}
                    aria-hidden
                />
                {username ? (
                    <>
                        <span className="sa-badge__name">{labels.signedInAs(username)}</span>
                        {level && (
                            <span className="sa-badge__level">
                                {labels.level(level.level)}
                                <span
                                    className="sa-badge__bar"
                                    role="img"
                                    aria-label={`${level.pct}% to level ${level.level + 1}`}
                                >
                                    <span className="sa-badge__fill" style={{ width: `${level.pct}%` }} />
                                </span>
                            </span>
                        )}
                    </>
                ) : (
                    <span className="sa-badge__muted">{labels.signedOut}</span>
                )}
                <span className="sa-badge__chev" aria-hidden>
                    {open ? '▼' : '▲'}
                </span>
            </button>
        </div>
    )
}

export default AccountBadge
