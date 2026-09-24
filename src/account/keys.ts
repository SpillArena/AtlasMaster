/**
 * Where the session is stored.
 *
 * Its own module because session.ts and consent.ts both need it at load time
 * and import each other: a constant read while the other file is still
 * loading would be undefined — or throw — depending on which loaded first.
 */
export const SESSION_STORAGE_KEY = 'spillarena.session'
