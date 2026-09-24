// One SpillArena account, shared by every game on the domain.
//
// This folder is VENDORED: the same files exist in AtlasMaster, ScribbleBot,
// HangBot, ProportionPanic, PixelPanic and FleetBot, byte for byte. SpillArena
// is the canonical copy — fix it here, then copy it out. That is why the
// comments in this folder are English while the rest of this repo is
// Norwegian: this file also lives in repos that are written in English.

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
    /*
     * One code per reason.
     *
     * These three used to arrive as a single `bad_username`, which left the
     * form able to say only "that name cannot be used" — true, and useless:
     * the player still had to guess whether the name was too long, held a
     * character that is not allowed, or was empty.
     */
    | 'username_empty'
    | 'username_too_long'
    | 'username_chars'
    /** The name filter rejected it: a reserved word, or one on the block list. */
    | 'name_reserved'
    | 'name_not_allowed'
    | 'bad_pin'
    | 'bad_credentials'
    | 'bad_body'
    | 'bad_action'
    | 'name_taken'
    | 'locked'
    /** Returned on sign-in with the right PIN, and as a 401 on any signed call. */
    | 'banned'
    | 'not_configured'
    | 'unauthorized'
    | 'service_failed'
    | 'unreachable'

/**
 * `retryAfter` is seconds, and only ever accompanies `locked`.
 *
 * The service knows exactly how long the lockout has left, so saying "try
 * again later" instead of a number was throwing away something it already had.
 * A player told "later" either retries immediately and gets the same answer, or
 * gives up.
 */
export type AuthFailure = { ok: false; error: AuthErrorCode; retryAfter?: number }

export type AuthResult = { ok: true; session: Session } | AuthFailure

export type ApiResult<T> = { ok: true; data: T } | AuthFailure

/** The path segment the game is served under: spillarena.no/<id>. */
export type GameId = 'atlasmaster' | 'scribblebot' | 'hangbot' | 'proportionpanic' | 'pixelpanic' | 'fleetbot'

export interface ProfileResponse<T> {
    game: GameId
    progress: T | null
    updatedAt: string | null
}

export interface AccountOverview {
    username: string
    createdAt: string
    lastSeen: string
    /**
     * Only the front page reads this, to decide whether to offer the admin panel.
     * It opens nothing by itself: every admin call checks the flag again.
     */
    admin?: boolean
    games: Partial<Record<GameId, { progress: unknown; updatedAt: string }>>
}
