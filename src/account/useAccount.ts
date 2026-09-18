import { useCallback, useEffect, useState } from 'react'
import { authenticate, verifySession } from './api'
import { getSession, onSessionChange, signOut } from './session'
import type { AuthAction, AuthResult, Session } from './types'

/**
 * The session as React state, kept in step with every tab.
 *
 * `checking` is true until the stored token has been confirmed against the
 * service once. The distinction matters for what the header renders: a stored
 * token is enough to show a name immediately, but not enough to promise the
 * account still exists, so a header that flashes 'Sign in' and then a username
 * is worse than one that waits a beat.
 */
export function useAccount() {
    const [session, setLocalSession] = useState<Session | null>(() => getSession())
    const [checking, setChecking] = useState<boolean>(() => getSession() !== null)

    useEffect(() => onSessionChange(setLocalSession), [])

    useEffect(() => {
        // `checking` starts false when there was nothing to check, so this
        // effect never has to set state on the way out
        if (!getSession()) return
        let cancelled = false
        void verifySession().finally(() => {
            // an unreachable service leaves the stored session alone — see
            // `call` in api.ts: only a 401 signs out
            if (!cancelled) setChecking(false)
        })
        return () => {
            cancelled = true
        }
    }, [])

    const submit = useCallback(
        (action: AuthAction, username: string, pin: string): Promise<AuthResult> =>
            authenticate(action, username, pin),
        [],
    )

    return {
        session,
        username: session?.username ?? null,
        isSignedIn: session !== null,
        checking,
        authenticate: submit,
        signOut,
    }
}
