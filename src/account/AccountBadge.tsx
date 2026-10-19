import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { authenticate } from './api'
import { getSession, onSessionChange, signOut } from './session'
import { levelProgress } from './progress'
import { PlayerAvatar } from './avatar'
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
.sa-root { --sa-edge: clamp(10px, 1.2vw, 16px); position: fixed; z-index: 2147483000; }
.sa-badge {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  gap: 6px;
  min-height: 32px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.82);
  color: #1e293b;
  font: 500 11px/1.2 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  text-decoration: none;
  letter-spacing: 0.01em;
  box-shadow: 0 6px 20px -8px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
  max-width: min(calc(100vw - 2 * var(--sa-edge)), 280px);
  cursor: pointer;
}
.sa-badge:hover { transform: translateY(-1px); box-shadow: 0 10px 26px -8px rgba(0, 0, 0, 0.5); }
.sa-badge:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }
.sa-badge__name { min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-badge__muted { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.66; }
.sa-badge__avatar {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 18px; height: 18px; overflow: hidden; border-radius: 5px;
  background: rgba(139, 92, 246, 0.16); font-size: 10px; font-weight: 700;
}

.sa-panel {
  --sa-accent: #7c3aed;
  --sa-ring: rgba(124, 58, 237, 0.28);
  --sa-field: #fff;
  --sa-line: rgba(15, 23, 42, 0.12);
  --sa-track: rgba(15, 23, 42, 0.06);
  --sa-thumb: #fff;
  position: absolute;
  text-align: left;
  box-sizing: border-box;
  width: min(calc(100vw - 2 * var(--sa-edge)), 316px);
  max-height: calc(100dvh - 80px);
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--sa-line);
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  font: 400 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 24px 60px -20px rgba(15, 23, 42, 0.45), 0 8px 20px -12px rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  transform-origin: top right;
  animation: sa-panel-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
}
@keyframes sa-panel-in { from { opacity: 0; transform: translateY(-6px) scale(0.97); } }

/* Segmented control: the thumb slides under whichever tab is chosen. */
.sa-panel__tabs {
  position: relative; display: grid; grid-template-columns: 1fr 1fr;
  padding: 4px; margin-bottom: 16px; border-radius: 12px; background: var(--sa-track);
}
.sa-panel__thumb {
  position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px);
  border-radius: 9px; background: var(--sa-thumb);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12), 0 4px 12px -4px rgba(15, 23, 42, 0.18);
  transition: transform 0.34s cubic-bezier(0.3, 1.35, 0.5, 1);
}
.sa-panel__tabs[data-mode="register"] .sa-panel__thumb { transform: translateX(100%); }
.sa-panel__tab {
  position: relative; z-index: 1; height: 36px; border: 0; background: transparent; border-radius: 9px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; line-height: 1; color: inherit; opacity: 0.55;
  transition: opacity 0.2s ease;
}
.sa-panel__tab:hover { opacity: 0.8; }
.sa-panel__tab[aria-selected="true"] { opacity: 1; }
.sa-panel__tab:focus-visible { outline: 2px solid var(--sa-accent); outline-offset: 2px; }

/* The form slides in from the side the chosen tab sits on. */
.sa-panel__body[data-dir="next"] { animation: sa-from-right 0.3s cubic-bezier(0.2, 0.9, 0.3, 1); }
.sa-panel__body[data-dir="prev"] { animation: sa-from-left 0.3s cubic-bezier(0.2, 0.9, 0.3, 1); }
@keyframes sa-from-right { from { opacity: 0; transform: translateX(28px); } }
@keyframes sa-from-left { from { opacity: 0; transform: translateX(-28px); } }

.sa-panel__label { display: block; font-size: 12px; font-weight: 600; opacity: 0.7; margin: 0 0 6px 2px; }
.sa-panel__input {
  display: block; width: 100%; height: 44px; box-sizing: border-box; padding: 0 14px; margin-bottom: 12px;
  border-radius: 12px; border: 1px solid var(--sa-line); background: var(--sa-field); color: inherit;
  /* 16px keeps iOS from zooming the page when the field takes focus */
  font-family: inherit; font-size: 16px; line-height: 1.2;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.sa-panel__input[type="password"] { letter-spacing: 0.3em; }
.sa-panel__input:focus { outline: none; border-color: var(--sa-accent); box-shadow: 0 0 0 4px var(--sa-ring); }
.sa-panel__submit {
  width: 100%; height: 44px; margin-top: 4px; border: 0; border-radius: 12px; cursor: pointer;
  background: linear-gradient(180deg, #8b5cf6, #7c3aed); color: #fff;
  font-family: inherit; font-size: 14px; font-weight: 700; line-height: 1;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 8px 18px -8px rgba(124, 58, 237, 0.7);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}
.sa-panel__submit:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 12px 24px -8px rgba(124, 58, 237, 0.75); }
.sa-panel__submit:not(:disabled):active { transform: translateY(0); }
.sa-panel__submit:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.sa-panel__submit:focus-visible, .sa-panel__signout:focus-visible { outline: 2px solid var(--sa-accent); outline-offset: 2px; }
.sa-panel__error { margin: 0 0 10px; padding: 9px 12px; border-radius: 10px; background: rgba(220, 38, 38, 0.08); color: #b91c1c; font-size: 12.5px; font-weight: 600; }
.sa-panel__hint { margin: 12px 0 0; font-size: 12px; line-height: 1.5; opacity: 0.6; }
.sa-panel__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sa-panel__who { font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-panel__link { color: var(--sa-accent); font-size: 12.5px; font-weight: 600; text-decoration: none; }
.sa-panel__link:hover { text-decoration: underline; text-underline-offset: 3px; }
.sa-panel__forgot { display: block; margin-top: 12px; color: inherit; opacity: 0.65; font-size: 12.5px; text-align: center; text-decoration: none; }
.sa-panel__forgot:hover { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }
.sa-panel__signout {
  margin-top: 14px; width: 100%; height: 40px; cursor: pointer;
  border-radius: 12px; border: 1px solid var(--sa-line); background: transparent; color: inherit;
  font-family: inherit; font-size: 13px; font-weight: 600; line-height: 1;
  transition: background-color 0.15s ease;
}
.sa-panel__signout:hover { background: var(--sa-track); }
.sa-panel__storage {
  margin: 0 0 12px; padding: 10px 12px; border-radius: 12px;
  border: 1px solid rgba(217, 119, 6, 0.25); background: rgba(254, 243, 199, 0.7);
  color: #78350f; font-size: 12px; line-height: 1.45;
}
.sa-panel__storage button {
  display: block; margin-top: 6px; padding: 0; border: 0; background: none; cursor: pointer;
  color: inherit; font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1.3; text-decoration: underline; text-underline-offset: 3px;
}
.sa-panel__meter { margin: 12px 0 2px; height: 8px; border-radius: 999px; background: var(--sa-track); overflow: hidden; }
.sa-panel__meterfill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #a78bfa, #7c3aed); transition: width 0.4s ease; }

@media (prefers-color-scheme: dark) {
  .sa-badge {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(15, 23, 42, 0.78);
    color: #e2e8f0;
  }
  .sa-panel {
    --sa-accent: #a78bfa;
    --sa-ring: rgba(167, 139, 250, 0.3);
    --sa-field: rgba(255, 255, 255, 0.05);
    --sa-line: rgba(255, 255, 255, 0.12);
    --sa-track: rgba(255, 255, 255, 0.07);
    --sa-thumb: rgba(255, 255, 255, 0.14);
    background: rgba(17, 24, 39, 0.94);
    color: #e5e7eb;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 24px 60px -20px rgba(0, 0, 0, 0.8), 0 8px 20px -12px rgba(0, 0, 0, 0.6);
  }
  .sa-panel__thumb { box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset, 0 4px 12px -4px rgba(0, 0, 0, 0.5); }
  .sa-panel__submit { background: linear-gradient(180deg, #8b5cf6, #6d28d9); }
  .sa-panel__error { background: rgba(248, 113, 113, 0.12); color: #fca5a5; }
  .sa-panel__storage { border-color: rgba(251, 191, 36, 0.22); background: rgba(120, 53, 15, 0.35); color: #fde68a; }
}
@media (prefers-reduced-motion: reduce) {
  .sa-panel, .sa-panel__body { animation: none !important; }
  .sa-panel__thumb, .sa-panel__submit, .sa-panel__input { transition: none; }
}
@media (max-width: 1280px), (max-height: 720px) {
  .sa-badge { max-width: min(calc(100vw - 2 * var(--sa-edge)), 220px); }
}
@media (max-width: 480px) {
  .sa-badge { gap: 5px; padding: 5px 8px; max-width: min(60vw, 200px); }
}
@media (prefers-reduced-motion: reduce) { .sa-badge { transition: none; } }

/*
 * In the header the badge is one of the nav buttons: the same 40px box as the
 * lobby link and settings, in the game's own colours, so it never floats over
 * the game. It shrinks to its icon on phones, like the lobby link does.
 */
.sa-root--header { position: relative; z-index: auto; flex: none; }
.sa-root--header .sa-badge {
  height: 40px; min-height: 40px; min-width: 40px; max-width: 180px;
  padding: 0 12px 0 10px; gap: 8px; border-radius: 10px;
  border: 1px solid var(--arena-rule, rgba(0, 0, 0, 0.12));
  background: color-mix(in srgb, currentColor 7%, transparent);
  color: var(--arena-ink, inherit);
  font-family: inherit; font-size: 13px; font-weight: 700; line-height: 1; letter-spacing: 0;
  box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none;
}
.sa-root--header .sa-badge:hover { transform: none; box-shadow: none; background: color-mix(in srgb, currentColor 13%, transparent); }
.sa-root--header .sa-badge__avatar { width: 22px; height: 22px; border-radius: 6px; font-size: 11px; }
.sa-root--header .sa-badge__icon { display: block; flex: none; width: 18px; height: 18px; }
.sa-root--header .sa-badge__muted { opacity: 1; }
.sa-root--header .sa-panel { top: calc(100% + 10px); z-index: 60; }
@media (max-width: 720px) {
  .sa-root--header .sa-badge { width: 40px; padding: 0; justify-content: center; }
  .sa-root--header .sa-badge__name, .sa-root--header .sa-badge__muted { display: none; }
}
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
    'bottom-right': { bottom: 'max(var(--sa-edge), env(safe-area-inset-bottom))', right: 'max(var(--sa-edge), env(safe-area-inset-right))' },
    'bottom-left': { bottom: 'max(var(--sa-edge), env(safe-area-inset-bottom))', left: 'max(var(--sa-edge), env(safe-area-inset-left))' },
    'top-right': { top: 'max(var(--sa-edge), env(safe-area-inset-top))', right: 'max(var(--sa-edge), env(safe-area-inset-right))' },
    'top-left': { top: 'max(var(--sa-edge), env(safe-area-inset-top))', left: 'max(var(--sa-edge), env(safe-area-inset-left))' },
} as const

/** The front page, opened straight into the forgotten-PIN form. */
const recoverUrl = (homeUrl: string) => `${homeUrl.replace(/\/+$/, '')}/?recover=1`

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
    /**
     * The link under the sign-in form. A PIN is reset on the front page, not in
     * the badge: that is where the code is shown and kept, once.
     */
    forgotPin: string
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
    forgotPin: 'Forgot your PIN?',
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
    forgotPin: 'Glemt PIN?',
    working: 'Jobber …',
    signOut: 'Logg ut',
    profile: 'Profil på spillarena.no',
    guestHint: 'Du kan spille uten konto. Logger du inn, lagres resultatene dine på ledertavla.',
    level: (level) => `Nivå ${level}`,
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
     * AtlasMaster's own richer one, which predates the shared engine. The level
     * and progress are shown in the panel when the player presses the badge.
     */
    progress?: { xp: number } | null
    /**
     * A screen corner, or 'header' to sit in the game's nav bar beside the
     * lobby link and settings. Render it inside SiteHeader for that.
     */
    corner?: keyof typeof CORNERS | 'header'
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
    /** Which way the form slides after a tab switch; none on first open. */
    const [slide, setSlide] = useState<'next' | 'prev' | null>(null)
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
    const inHeader = corner === 'header'
    /** How far the header panel moves right, so it lines up with the nav's edge. */
    const [panelShift, setPanelShift] = useState(0)

    useLayoutEffect(() => {
        if (!open || !inHeader) return
        const place = () => {
            const root = rootRef.current
            const nav = root?.parentElement
            if (!root || !nav) return
            setPanelShift(Math.min(0, root.getBoundingClientRect().right - nav.getBoundingClientRect().right))
        }
        place()
        window.addEventListener('resize', place)
        return () => window.removeEventListener('resize', place)
    }, [open, inHeader])

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
        if (next !== mode) setSlide(next === 'register' ? 'next' : 'prev')
        setMode(next)
        setError(null)
        setRetryAfter(undefined)
        setMismatch(false)
        setConfirm('')
    }

    const level = progress ? levelProgress(progress.xp) : null
    const title = username ? labels.signedInAs(username) : labels.signedOut

    return (
        <div
            className={inHeader ? 'sa-root sa-root--header' : 'sa-root'}
            style={corner === 'header' ? undefined : CORNERS[corner]}
            ref={rootRef}
        >
            {open && (
                <div
                    className="sa-panel"
                    style={corner === 'header' ? { right: panelShift } : PANEL_POSITION[corner]}
                    role="dialog"
                    aria-label={title}
                >
                    {username ? (
                        <>
                            <div className="sa-panel__row">
                                <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                    <PlayerAvatar size={26} />
                                    <span className="sa-panel__who">{username}</span>
                                </span>
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
                            <div className="sa-panel__tabs" role="tablist" data-mode={mode}>
                                <span className="sa-panel__thumb" aria-hidden="true" />
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

                            <div key={mode} className="sa-panel__body" data-dir={slide ?? undefined}>
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

                                {mode === 'login' && (
                                    <a className="sa-panel__forgot" href={recoverUrl(homeUrl)}>
                                        {labels.forgotPin}
                                    </a>
                                )}

                                <p className="sa-panel__hint">{labels.guestHint}</p>
                            </div>
                        </form>
                    )}
                </div>
            )}

            <button
                type="button"
                className="sa-badge"
                onClick={() => setOpen((value) => !value)}
                aria-label={title}
                aria-expanded={open}
                aria-haspopup="dialog"
                title={title}
            >
                {username ? (
                    <>
                        <span className="sa-badge__avatar" aria-hidden="true">
                            <PlayerAvatar fallback={Array.from(username)[0]?.toLocaleUpperCase()} />
                        </span>
                        <span className="sa-badge__name" aria-hidden>{username}</span>
                    </>
                ) : (
                    <>
                        {inHeader && (
                            <svg className="sa-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 21a8 8 0 0 1 16 0" />
                            </svg>
                        )}
                        <span className="sa-badge__muted">{labels.signedOut}</span>
                    </>
                )}
            </button>
        </div>
    )
}

export default AccountBadge
