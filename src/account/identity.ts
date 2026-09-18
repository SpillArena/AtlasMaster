import { useEffect, useState } from 'react'
import { getSession, onSessionChange } from './session'

/**
 * Who the player is competing as — and whether they get a say in it.
 *
 * Signed in, they do not. The name on a leaderboard row is taken from the
 * signed token by every game's API (see each `functions/api/leaderboard*`), so
 * a name typed into a game while signed in is a name that reaches nothing. A
 * field that accepts input and then ignores it is worse than no field: it
 * invites the player to set something and quietly discards it.
 *
 * So `locked` is not a styling hint. It means: do not ask, do not validate,
 * do not let this be edited. Every game shows the account name as a fact
 * instead, and points at spillarena.no for changing it.
 *
 * VALIDATION IS THE PART THAT IS EASY TO GET WRONG. Games have their own
 * username rules — ScribbleBot wants /^[a-zA-Z0-9_æøåÆØÅ]{2,16}$/, FleetBot has
 * its own, HangBot has a reserved-word list. Account names are validated once,
 * when the account is made, against a LOOSER rule that allows spaces, dots and
 * apostrophes. Running a game's stricter rule over an account name would lock a
 * legitimate player — "Emil B." — out of their own game. When `locked` is true,
 * the game's rule must be skipped entirely; the name has already passed the
 * only check that governs it.
 */
export interface Identity {
    /** The name to compete under. */
    name: string
    /** True when it comes from the account and must not be edited or re-validated. */
    locked: boolean
}

export function resolveIdentity(localName = ''): Identity {
    const account = getSession()?.username
    return account ? { name: account, locked: true } : { name: localName, locked: false }
}

/**
 * The same, as React state, following sign-in and sign-out in every tab.
 *
 * The cross-tab part matters here: signing in happens on the front page, very
 * often in a different tab from the game. Without it a game would keep asking
 * for a name the player has already been given.
 */
export function useIdentity(localName = ''): Identity {
    // only the account is external state worth subscribing to; the identity
    // itself is derived during render, so a change to `localName` needs no
    // effect to catch up
    const [account, setAccount] = useState<string | null>(() => getSession()?.username ?? null)

    useEffect(() => onSessionChange((session) => setAccount(session?.username ?? null)), [])

    return account ? { name: account, locked: true } : { name: localName, locked: false }
}
