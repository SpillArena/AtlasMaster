import type { Session } from './types'

/**
 * The session, and why one login covers every game.
 *
 * Every game is served from https://spillarena.no — the router strips
 * /<game> before it proxies on, so the browser never leaves the origin. One
 * origin means ONE localStorage. A token written here by the front page is the
 * same token AtlasMaster reads a click later; there is no cross-domain
 * handshake to get wrong, because there is no second domain.
 *
 * The consequence to remember: the key below is shared, so it must not collide
 * with anything a game stores on its own. Games that used to keep a session
 * under their own key ('auth' in AtlasMaster) migrate away from it — see
 * adoptLegacySession.
 *
 * Nothing here talks to the network; see api.ts for that.
 */

const STORAGE_KEY = 'spillarena.session'

/**
 * Consent gate.
 *
 * Every repo has its own cookie-consent module, and this folder is copied
 * between them, so it cannot import any of them. The host app injects the
 * check instead. Default: allowed — a game with no consent layer should not
 * silently fail to log anyone in.
 */
let hasConsent: () => boolean = () => true

/** Held in memory so a declined consent still gives a working session. */
let session: Session | null | undefined

type Listener = (session: Session | null) => void
const listeners = new Set<Listener>()

export function configureSession(options: { hasConsent?: () => boolean }): void {
    if (options.hasConsent) hasConsent = options.hasConsent
    // a consent answer can arrive after the first read cached a null
    session = undefined
}

function isValid(value: unknown): value is Session {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Partial<Session>
    return (
        typeof candidate.username === 'string' &&
        typeof candidate.token === 'string' &&
        typeof candidate.expiresAt === 'number' &&
        // an expired token is no better than none: ask again instead
        candidate.expiresAt > Date.now()
    )
}

function read(): Session | null {
    if (session !== undefined) return session
    session = null
    if (typeof window === 'undefined' || !hasConsent()) return session
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const parsed: unknown = raw ? JSON.parse(raw) : null
        if (isValid(parsed)) session = parsed
    } catch {
        session = null
    }
    return session
}

export function getSession(): Session | null {
    return read()
}

export function getToken(): string | null {
    return read()?.token ?? null
}

export function getUsername(): string | null {
    return read()?.username ?? null
}

export function isSignedIn(): boolean {
    return read() !== null
}

export function setSession(next: Session | null): void {
    session = next
    if (typeof window !== 'undefined' && hasConsent()) {
        try {
            if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
            else window.localStorage.removeItem(STORAGE_KEY)
        } catch {
            // a full or blocked storage is not a reason to drop the session in memory
        }
    }
    for (const listener of listeners) listener(next)
}

export function signOut(): void {
    setSession(null)
}

/** Forgets the in-memory copy — call when stored data is cleared. */
export function forgetSession(): void {
    session = undefined
}

/**
 * Notifies on sign-in and sign-out, in THIS tab and in others.
 *
 * The cross-tab half matters more than it looks: the player can have the front
 * page open in one tab and a game in another. Signing out on the front page
 * has to reach the game, or the game keeps pushing to an account the player
 * believes they left.
 */
export function onSessionChange(listener: Listener): () => void {
    listeners.add(listener)

    const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== STORAGE_KEY) return
        session = undefined
        listener(read())
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)

    return () => {
        listeners.delete(listener)
        if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    }
}

/**
 * Takes over a session a game stored under its own key before the accounts
 * were shared, then removes it.
 *
 * AtlasMaster kept the same shape under 'auth'. Its tokens are still valid —
 * the signing key and the username did not change, only which service issues
 * them — so a player who was signed in there stays signed in, now everywhere.
 * Safe to call on every start: once the old key is gone it does nothing.
 */
export function adoptLegacySession(legacyKey: string): void {
    if (typeof window === 'undefined' || !hasConsent()) return
    try {
        const raw = window.localStorage.getItem(legacyKey)
        if (!raw) return
        window.localStorage.removeItem(legacyKey)
        const parsed: unknown = JSON.parse(raw)
        if (!read() && isValid(parsed)) setSession(parsed)
    } catch {
        // unreadable leftovers are not worth failing a startup for
    }
}
