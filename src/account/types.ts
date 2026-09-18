// One SpillArena account, shared by every game on the domain.
//
// This folder is VENDORED: the same files exist in AtlasMaster, ScribbleBot,
// HangBot, ProportionPanic and FleetBot, byte for byte. SpillArena is the
// canonical copy — fix it here, then copy it out. That is why the comments in
// this folder are English while the rest of this repo is Norwegian: this file
// also lives in repos that are written in English.

/** A signed, non-secret proof of who the player is. Lives 30 days. */
export interface Session {
    username: string
    token: string
    /** milliseconds since the epoch */
    expiresAt: number
}

export type AuthAction = 'register' | 'login'

/**
 * Error codes are stable strings, never sentences: the client translates them.
 * A sentence from a Worker can only be shown as-is, in whatever language the
 * Worker happened to be written in.
 */
export type AuthErrorCode =
    | 'bad_username'
    | 'bad_pin'
    | 'bad_credentials'
    | 'bad_body'
    | 'bad_action'
    | 'name_taken'
    | 'locked'
    | 'not_configured'
    | 'unauthorized'
    | 'service_failed'
    | 'unreachable'

export type AuthResult = { ok: true; session: Session } | { ok: false; error: AuthErrorCode }

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: AuthErrorCode }

/** The path segment the game is served under: spillarena.no/<id>. */
export type GameId = 'atlasmaster' | 'scribblebot' | 'hangbot' | 'proportionpanic' | 'fleetbot'

export interface ProfileResponse<T> {
    game: GameId
    progress: T | null
    updatedAt: string | null
}

export interface AccountOverview {
    username: string
    createdAt: string
    lastSeen: string
    games: Partial<Record<GameId, { progress: unknown; updatedAt: string }>>
}
