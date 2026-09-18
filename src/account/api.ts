import { getToken, setSession, signOut } from './session'
import type {
    AccountOverview,
    ApiResult,
    AuthAction,
    AuthErrorCode,
    AuthResult,
    GameId,
    ProfileResponse,
    Session,
} from './types'

/**
 * Calls to the account service on the front page.
 *
 * The path is ROOT-ABSOLUTE and stays that way in every game. A game is served
 * under /<game>/, so `import.meta.env.BASE_URL` would point at the game's own
 * Pages project — which has no accounts in it. '/api' is the front page's
 * project, and that is the one place that owns identity.
 *
 * In local development there is no router and no front page on :5173, so each
 * game proxies /api onward in its vite config (see the proxy block there).
 * VITE_ACCOUNT_API overrides the base when you'd rather point at a deployed
 * preview.
 */
const API_BASE = (import.meta.env.VITE_ACCOUNT_API as string | undefined) ?? '/api'

/** A player waits a few seconds for a login; past that, tell them it's unreachable. */
const TIMEOUT_MS = 8000

const isErrorCode = (value: unknown): value is AuthErrorCode => typeof value === 'string'

async function call<T>(
    path: string,
    init: RequestInit & { auth?: boolean } = {},
): Promise<ApiResult<T>> {
    const { auth = false, headers, ...rest } = init

    const token = auth ? getToken() : null
    if (auth && !token) return { ok: false, error: 'unauthorized' }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
        const response = await fetch(`${API_BASE}${path}`, {
            ...rest,
            signal: controller.signal,
            headers: {
                ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...headers,
            },
        })

        /*
         * A rejected token is the one error worth acting on here rather than
         * reporting upward: it means the account is gone or the signing key
         * changed, and every later call would fail the same way. Dropping the
         * session turns an endless stream of 401s into one sign-in prompt.
         */
        if (response.status === 401) {
            signOut()
            return { ok: false, error: 'unauthorized' }
        }

        const body: unknown = await response.json().catch(() => null)
        if (!response.ok) {
            const error = (body as { error?: unknown } | null)?.error
            return { ok: false, error: isErrorCode(error) ? error : 'service_failed' }
        }
        return { ok: true, data: body as T }
    } catch {
        // an aborted or failed fetch is indistinguishable from here, and the
        // player needs the same answer for both: the service did not reply
        return { ok: false, error: 'unreachable' }
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Registers or signs in, and stores the session on success.
 *
 * The PIN never leaves this call: it is sent once to get a signed token back,
 * and the token is the only thing stored. A device left open does not have the
 * PIN sitting in it.
 *
 * 'name does not exist' and 'wrong PIN' come back as the same error on
 * purpose — told apart, the sign-in form becomes a list of who plays here.
 */
export async function authenticate(
    action: AuthAction,
    username: string,
    pin: string,
): Promise<AuthResult> {
    const result = await call<Session>('/auth', {
        method: 'POST',
        body: JSON.stringify({ action, username: username.trim(), pin }),
    })
    if (!result.ok) return result
    const { username: name, token, expiresAt } = result.data
    if (!name || !token || !expiresAt) return { ok: false, error: 'service_failed' }
    const session: Session = { username: name, token, expiresAt }
    setSession(session)
    return { ok: true, session }
}

/**
 * Asks the service whether the stored token is still good.
 *
 * Worth one call at startup: the token is verified by signature alone, so
 * nothing else would ever notice that the account was deleted or the signing
 * key rotated. A failure signs out (see `call`), so the answer is a boolean.
 */
export async function verifySession(): Promise<boolean> {
    return (await call<{ username: string }>('/auth', { auth: true })).ok
}

/** The account's profile for one game, or null when it has never played. */
export function fetchProfile<T>(game: GameId): Promise<ApiResult<ProfileResponse<T>>> {
    return call<ProfileResponse<T>>(`/profile/${game}`, { auth: true })
}

/** Mirrors the local profile onto the account. The game owns the shape. */
export function pushProfile(
    game: GameId,
    progress: unknown,
): Promise<ApiResult<{ game: GameId; updatedAt: string }>> {
    return call(`/profile/${game}`, { auth: true, method: 'POST', body: JSON.stringify(progress) })
}

/** Clears one game's profile. The account and the other games stay. */
export function clearProfile(game: GameId): Promise<ApiResult<{ deleted: boolean }>> {
    return call(`/profile/${game}`, { auth: true, method: 'DELETE' })
}

/** Every game at once — what the profile page on the front page shows. */
export function fetchAccount(): Promise<ApiResult<AccountOverview>> {
    return call<AccountOverview>('/profile', { auth: true })
}

/**
 * Changes the username, and stores the fresh token it returns.
 *
 * A new token is not a nicety: the signature covers the name, so the token the
 * caller arrived with names an account that no longer exists the moment the row
 * is renamed. Without replacing it the player would be signed out of all five
 * games by renaming themselves.
 *
 * Leaderboard rows already posted keep the OLD name — they live in each game's
 * own database, which this service does not touch. Tell the player that before
 * they rename, not after.
 */
export async function renameAccount(pin: string, newUsername: string): Promise<AuthResult> {
    const result = await call<Session>('/account', {
        auth: true,
        method: 'POST',
        body: JSON.stringify({ action: 'rename', pin, newUsername: newUsername.trim() }),
    })
    if (!result.ok) return result
    const session: Session = {
        username: result.data.username,
        token: result.data.token,
        expiresAt: result.data.expiresAt,
    }
    setSession(session)
    return { ok: true, session }
}

/** Changes the PIN and stores the fresh token it returns. */
export async function changePin(pin: string, newPin: string): Promise<AuthResult> {
    const result = await call<Session>('/account', {
        auth: true,
        method: 'POST',
        body: JSON.stringify({ action: 'change-pin', pin, newPin }),
    })
    if (!result.ok) return result
    const session: Session = {
        username: result.data.username,
        token: result.data.token,
        expiresAt: result.data.expiresAt,
    }
    setSession(session)
    return { ok: true, session }
}

/**
 * Deletes the account and every profile on it, then signs out.
 *
 * Leaderboard rows in the games' own databases are NOT touched — those live in
 * separate databases, and a score on a board is an entry in a list other people
 * read, not data the account carries around.
 */
export async function deleteAccount(pin: string): Promise<ApiResult<{ deleted: boolean }>> {
    const result = await call<{ deleted: boolean }>('/account', {
        auth: true,
        method: 'DELETE',
        body: JSON.stringify({ pin }),
    })
    if (result.ok) signOut()
    return result
}
