import { useEffect, useState } from 'react'
import { getSession, onSessionChange } from './session'
import { levelProgress } from './progress'

/**
 * "Logged in as X", in the corner of every game.
 *
 * One account covers the whole domain, but a player moving from the front page
 * into a game has no way of knowing that unless something says so. This is that
 * something: small, always in the same place, and the same in all five games.
 *
 * It does not offer a sign-in FORM. Signing in happens on spillarena.no, once —
 * that is the whole premise, and a second login form inside a game would
 * suggest otherwise. Signed out, this is a link there.
 *
 * Styling is inline plus one injected stylesheet, deliberately: this file is
 * vendored into five repos that disagree about Tailwind versions and theme
 * variables, and a badge that renders correctly everywhere is worth more than
 * one that inherits perfectly in the one repo it was written for.
 */

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
.sa-badge {
  position: fixed;
  z-index: 2147483000;
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
@media (prefers-color-scheme: dark) {
  .sa-badge {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(15, 23, 42, 0.78);
    color: #e2e8f0;
  }
  .sa-badge__level { background: rgba(167, 139, 250, 0.2); color: #c4b5fd; }
  .sa-badge__bar { background: rgba(196, 181, 253, 0.25); }
  .sa-badge__fill { background: #a78bfa; }
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

export interface AccountBadgeProps {
    /**
     * Anything carrying an XP total — every game's profile qualifies, including
     * AtlasMaster's own richer one, which predates the shared engine. Left out,
     * the badge shows only the name.
     */
    progress?: { xp: number } | null
    corner?: keyof typeof CORNERS
    /** Where signing in happens. The front page, unless a game says otherwise. */
    homeUrl?: string
    /** Text for the signed-out state, so each game can translate it. */
    signedOutLabel?: string
    /** Given a username, the signed-in text. Defaults to `Logged in as X`. */
    signedInLabel?: (username: string) => string
}

export function AccountBadge({
    progress = null,
    corner = 'bottom-right',
    homeUrl = 'https://spillarena.no',
    signedOutLabel = 'Not signed in',
    signedInLabel = (username) => `Logged in as ${username}`,
}: AccountBadgeProps) {
    useInjectedStyle()

    const [username, setUsername] = useState<string | null>(() => getSession()?.username ?? null)

    // signing in happens on the front page, which is very often another tab in
    // the same browser — without this the game would keep saying "not signed in"
    // until it was reloaded
    useEffect(() => onSessionChange((session) => setUsername(session?.username ?? null)), [])

    const level = progress ? levelProgress(progress.xp) : null

    return (
        <a
            className="sa-badge"
            style={CORNERS[corner]}
            href={homeUrl}
            title={username ? `${signedInLabel(username)} — spillarena.no` : `${signedOutLabel} — spillarena.no`}
        >
            <span className={username ? 'sa-badge__dot' : 'sa-badge__dot sa-badge__dot--out'} aria-hidden />
            {username ? (
                <>
                    <span className="sa-badge__name">{signedInLabel(username)}</span>
                    {level && (
                        <span className="sa-badge__level">
                            Lv {level.level}
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
                <span className="sa-badge__muted">{signedOutLabel}</span>
            )}
        </a>
    )
}

export default AccountBadge
