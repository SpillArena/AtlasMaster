import { SESSION_STORAGE_KEY } from './keys'
import { forgetSession, getSession, setSession } from './session'

/**
 * One answer to "may we store things in this browser?" — for the whole domain.
 *
 * Every game is served from spillarena.no, so every game shares ONE
 * localStorage. Before this file, each game asked (or did not ask) on its own:
 * AtlasMaster and the front page shared a key, ScribbleBot had its own, and
 * four games stored everything without asking at all. A player who declined on
 * the front page still had their session written to disk by the first game
 * they opened. Now the answer lives under one key, the front page and every
 * game read the same key, and the same dialog (ConsentDialog.tsx) asks it.
 *
 * WHAT A "NO" MEANS, precisely: nothing is written to disk. It does NOT mean
 * nothing works. The session, the local profile and every setting are kept in
 * memory for the life of the tab — see `consentStorage` below — so a player
 * who declines can still sign in from the badge, play, and have their progress
 * and results saved to their ACCOUNT. What they lose is being remembered: the
 * next page load starts signed out.
 */

export type ConsentStatus = 'accepted' | 'declined' | null

export const CONSENT_KEY = 'cookie-consent'

type Listener = (status: ConsentStatus) => void
const listeners = new Set<Listener>()

/** Keys a game has said it stores. Wiped on "no", wherever the "no" was given. */
const declared = new Set<string>([SESSION_STORAGE_KEY])

/**
 * Values written while there is no consent. They make the rest of the visit
 * behave normally — a chosen theme stays chosen — without touching the disk.
 */
const memory = new Map<string, string>()

function disk(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage
    } catch {
        // some browsers throw on the mere access when site data is blocked
        return null
    }
}

export function getConsent(): ConsentStatus {
    try {
        const stored = disk()?.getItem(CONSENT_KEY)
        return stored === 'accepted' || stored === 'declined' ? stored : null
    } catch {
        return null
    }
}

export function hasConsent(): boolean {
    return getConsent() === 'accepted'
}

function wipe(): void {
    const store = disk()
    if (!store) return
    for (const key of declared) {
        try {
            store.removeItem(key)
        } catch {
            // blocked storage has nothing in it to remove
        }
    }
}

/**
 * Records the answer. The answer itself is always stored — it is the one thing
 * that has to be, or the question comes back on every page.
 */
export function setConsent(status: Exclude<ConsentStatus, null>): void {
    try {
        disk()?.setItem(CONSENT_KEY, status)
    } catch {
        // the answer holds for this visit even if it cannot be remembered
    }

    if (status === 'accepted') {
        /*
         * Whatever was kept in memory goes to disk now. The session matters
         * most: a player who signed in before answering would otherwise be
         * signed out the moment they opened the next game — exactly what they
         * just said yes to avoid.
         */
        const store = disk()
        for (const [key, value] of memory) {
            try {
                store?.setItem(key, value)
            } catch {
                break
            }
        }
        memory.clear()
        const session = getSession()
        if (session) {
            setSession(session)
        } else {
            // nobody signed in on this page, but a session from an earlier visit
            // may be on disk — read it again now that it may be used, and let the
            // badge and the sync hear about it
            forgetSession()
            const stored = getSession()
            if (stored) setSession(stored)
        }
    } else {
        /*
         * Copy what is on disk into memory before wiping it, so declining does
         * not reset the page under the player: they stay signed in and keep
         * their theme until the tab closes. Only the disk is cleared.
         */
        const store = disk()
        for (const key of declared) {
            try {
                const value = store?.getItem(key)
                if (value !== null && value !== undefined && key !== SESSION_STORAGE_KEY) {
                    memory.set(key, value)
                }
            } catch {
                // nothing readable, nothing to carry over
            }
        }
        wipe()
    }

    for (const listener of listeners) listener(status)
}

/**
 * Tells this module which keys the game stores, so a "no" can remove them.
 *
 * Call it once at startup with every key the game uses. If the answer is
 * already "no" — given on the front page, or in another game — the keys are
 * wiped right away: the player said no before this game had a chance to hear
 * it, and whatever an older build wrote before then should not linger.
 */
export function declareStoredKeys(keys: readonly string[]): void {
    for (const key of keys) declared.add(key)
    if (getConsent() === 'declined') wipe()
}

/** Notifies on every change of answer, in this tab and in others. */
export function onConsentChange(listener: Listener): () => void {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
        if (event.key === CONSENT_KEY || event.key === null) listener(getConsent())
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
    return () => {
        listeners.delete(listener)
        if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    }
}

/**
 * localStorage, behind the answer.
 *
 * Accepted: it IS localStorage. Declined: reads and writes go to a Map that
 * lives as long as the page — the disk was wiped when they said no. Not yet
 * answered: writes go to the Map, but reads fall through to the disk.
 *
 * That last case is for players who were here before anyone asked. Four games
 * stored progress and settings without a consent question; their players have
 * data on disk and no answer. Hiding that data while the question is open —
 * and then writing the empty defaults over it when they say yes — would cost
 * them their local progress for having been asked. Reading it costs nothing:
 * nothing new is written until they answer, and a "no" removes it.
 *
 * Games route every key through this, so the rules hold without each call site
 * having to remember them. Storage errors are swallowed: private mode and full
 * disks must never cost the player a round.
 */
export const consentStorage = {
    get(key: string): string | null {
        const status = getConsent()
        if (status !== 'accepted') {
            if (memory.has(key)) return memory.get(key) ?? null
            if (status === 'declined') return null
        }
        try {
            return disk()?.getItem(key) ?? null
        } catch {
            return null
        }
    },
    set(key: string, value: string): void {
        if (!hasConsent()) {
            memory.set(key, value)
            return
        }
        try {
            disk()?.setItem(key, value)
        } catch {
            memory.set(key, value)
        }
    },
    remove(key: string): void {
        memory.delete(key)
        try {
            disk()?.removeItem(key)
        } catch {
            // nothing to remove from a store that cannot be read
        }
    },
}

/* ------------------------------------------------------------ the dialog -- */

const openers = new Set<() => void>()

/** Opens the consent dialog again — for a "privacy" entry in a settings menu. */
export function openConsentDialog(): void {
    for (const open of openers) open()
}

/** @internal Used by ConsentDialog to hear openConsentDialog(). */
export function onOpenConsentDialog(open: () => void): () => void {
    openers.add(open)
    return () => {
        openers.delete(open)
    }
}
