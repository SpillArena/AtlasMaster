import { SESSION_STORAGE_KEY } from './keys'
import { forgetSession, getSession, setSession } from './session'

/**
 * One answer to "may we store things in this browser?", for the whole domain.
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
 * memory for the life of the tab, see `consentStorage` below, so a player
 * who declines can still sign in from the badge, play, and have their progress
 * and results saved to their ACCOUNT. What they lose is being remembered: the
 * next page load starts signed out.
 */

export type ConsentStatus = 'accepted' | 'declined' | null

export const CONSENT_KEY = 'cookie-consent'

/**
 * WHAT MAY BE STORED, in three parts a player can choose between. The answer above stays 'accepted' or 'declined'
 * (accepted = at least one part), so everything that only asks "yes or no" keeps working.
 *
 * - session:  the sign-in, so the player is not asked again in every game
 * - progress: XP, levels, records, results and "today's round", so they are there next time
 * - settings: theme, language, sound, names and the like
 *
 * Which part a key belongs to is worked out from its name (`partOf`); a game can also say it outright with
 * `declareStoredKeys(keys, part)`. A part that is off behaves like a "no" for its keys only: kept in memory for the
 * life of the tab, never on disk.
 */
export type ConsentPart = 'session' | 'progress' | 'settings'
export const CONSENT_PARTS: readonly ConsentPart[] = ['session', 'progress', 'settings']

/** Only written when the answer is a yes to some parts and not all. Missing means all, as every earlier yes was. */
export const CONSENT_PARTS_KEY = 'cookie-consent-parts'

type Listener = (status: ConsentStatus) => void
const listeners = new Set<Listener>()

/** Keys a game has said it stores. Wiped on "no", wherever the "no" was given. */
const declared = new Set<string>([SESSION_STORAGE_KEY])

/** Parts a game has named outright. Everything else is sorted by `partOf`. */
const declaredParts = new Map<string, ConsentPart>()

const PROGRESS_KEY = /progress|\bxp\b|stat|streak|daily|recorded|local-game|runs|leaderboard|result|record|takes|best/i

/** The part a stored key belongs to. */
export function partOf(key: string): ConsentPart {
    const named = declaredParts.get(key)
    if (named) return named
    if (key === SESSION_STORAGE_KEY || key === 'auth') return 'session'
    return PROGRESS_KEY.test(key) ? 'progress' : 'settings'
}

/**
 * Values written while there is no consent. They make the rest of the visit
 * behave normally, a chosen theme stays chosen, without touching the disk.
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

/** The parts the player has said yes to. Empty for a "no", and before there is an answer. */
export function getConsentParts(): ConsentPart[] {
    if (getConsent() !== 'accepted') return []
    try {
        const raw = disk()?.getItem(CONSENT_PARTS_KEY)
        if (!raw) return [...CONSENT_PARTS]
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return [...CONSENT_PARTS]
        return CONSENT_PARTS.filter((part) => parsed.includes(part))
    } catch {
        return [...CONSENT_PARTS]
    }
}

/**
 * With a part: may that part be written to disk. Without one: did the player say yes to everything. Callers that
 * have not named a part get the strict reading, so a partial yes never lets them store more than it allows.
 */
export function hasConsent(part?: ConsentPart): boolean {
    if (getConsent() !== 'accepted') return false
    const parts = getConsentParts()
    return part ? parts.includes(part) : parts.length === CONSENT_PARTS.length
}

function wipe(parts: readonly ConsentPart[] = CONSENT_PARTS): void {
    const store = disk()
    if (!store) return
    for (const key of declared) {
        if (!parts.includes(partOf(key))) continue
        try {
            store.removeItem(key)
        } catch {
            // blocked storage has nothing in it to remove
        }
    }
}

/**
 * Records the answer. The answer itself is always stored, it is the one thing
 * that has to be, or the question comes back on every page.
 */
export function setConsent(status: Exclude<ConsentStatus, null>): void {
    setConsentParts(status === 'accepted' ? CONSENT_PARTS : [])
}

/** Records a yes to exactly these parts. None is a "no". */
export function setConsentParts(chosen: readonly ConsentPart[]): void {
    const next = CONSENT_PARTS.filter((part) => chosen.includes(part))
    const before = getConsentParts()
    const status: Exclude<ConsentStatus, null> = next.length > 0 ? 'accepted' : 'declined'
    try {
        const store = disk()
        if (next.length > 0 && next.length < CONSENT_PARTS.length) store?.setItem(CONSENT_PARTS_KEY, JSON.stringify(next))
        else store?.removeItem(CONSENT_PARTS_KEY)
        store?.setItem(CONSENT_KEY, status)
    } catch {
        // the answer holds for this visit even if it cannot be remembered
    }

    const turnedOn = next.filter((part) => !before.includes(part))
    // Idempotent: a part that was already off has nothing on disk, so wiping it again changes nothing.
    const turnedOff = CONSENT_PARTS.filter((part) => !next.includes(part))

    if (turnedOn.length > 0) {
        /*
         * Whatever was kept in memory for these parts goes to disk now. The
         * session matters most: a player who signed in before answering would
         * otherwise be signed out the moment they opened the next game,
         * exactly what they just said yes to avoid.
         */
        const store = disk()
        for (const [key, value] of memory) {
            if (!turnedOn.includes(partOf(key))) continue
            try {
                store?.setItem(key, value)
                memory.delete(key)
            } catch {
                break
            }
        }
        if (turnedOn.includes('session')) {
            const session = getSession()
            if (session) {
                setSession(session)
            } else {
                // nobody signed in on this page, but a session from an earlier visit
                // may be on disk, read it again now that it may be used, and let the
                // badge and the sync hear about it
                forgetSession()
                const stored = getSession()
                if (stored) setSession(stored)
            }
        }
    }

    if (turnedOff.length > 0) {
        /*
         * Copy what is on disk into memory before wiping it, so turning a part
         * off does not reset the page under the player: they stay signed in and
         * keep their theme until the tab closes. Only the disk is cleared.
         */
        const store = disk()
        for (const key of declared) {
            if (!turnedOff.includes(partOf(key))) continue
            try {
                const value = store?.getItem(key)
                if (value !== null && value !== undefined && key !== SESSION_STORAGE_KEY) {
                    memory.set(key, value)
                }
            } catch {
                // nothing readable, nothing to carry over
            }
        }
        wipe(turnedOff)
    }

    for (const listener of listeners) listener(status)
}

/**
 * Tells this module which keys the game stores, so a "no" can remove them.
 *
 * Call it once at startup with every key the game uses. If the answer is
 * already "no", given on the front page, or in another game, the keys are
 * wiped right away: the player said no before this game had a chance to hear
 * it, and whatever an older build wrote before then should not linger.
 */
export function declareStoredKeys(keys: readonly string[], part?: ConsentPart): void {
    for (const key of keys) {
        declared.add(key)
        if (part) declaredParts.set(key, part)
    }
    const status = getConsent()
    if (status === 'declined') wipe()
    else if (status === 'accepted') wipe(CONSENT_PARTS.filter((p) => !hasConsent(p)))
}

/** Notifies on every change of answer, in this tab and in others. */
export function onConsentChange(listener: Listener): () => void {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
        if (event.key === CONSENT_KEY || event.key === CONSENT_PARTS_KEY || event.key === null) listener(getConsent())
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
 * Accepted: it IS localStorage, for the parts the player said yes to; a part that
 * is off behaves as declined, for its keys only. Declined: reads and writes go to
 * a Map that lives as long as the page, the disk was wiped when they said no. Not yet
 * answered: writes go to the Map, but reads fall through to the disk.
 *
 * That last case is for players who were here before anyone asked. Four games
 * stored progress and settings without a consent question; their players have
 * data on disk and no answer. Hiding that data while the question is open -
 * and then writing the empty defaults over it when they say yes, would cost
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
        if (status === 'accepted' && hasConsent(partOf(key))) {
            try {
                return disk()?.getItem(key) ?? null
            } catch {
                return null
            }
        }
        if (memory.has(key)) return memory.get(key) ?? null
        if (status !== null) return null
        try {
            return disk()?.getItem(key) ?? null
        } catch {
            return null
        }
    },
    set(key: string, value: string): void {
        if (!hasConsent(partOf(key))) {
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

/** Opens the consent dialog again, for a "privacy" entry in a settings menu. */
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
