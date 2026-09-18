import type { GameId } from './types'

/**
 * XP, levels, personal bests and lifetime stats — the same engine in every game.
 *
 * Lifted from AtlasMaster, which had all of this before the accounts were
 * shared, and generalised so the other games get it without reinventing it.
 * What stayed is the property the whole thing rests on: EVERY FIELD ONLY EVER
 * GROWS. XP is a running sum, `plays` a count, `best` a maximum, each stat a
 * total or a maximum or a set union.
 *
 * That is not a style choice, it is what makes an account possible. Merging two
 * copies of a profile is then "take the larger of each pair", which is
 * idempotent and order-independent: a sync that arrives late, twice, or from a
 * device that was offline for a week can never make a profile worse than it
 * was. See `mergeProgress`, and `createProfileSync` in sync.ts for when it runs.
 *
 * Each game keeps its own document under its own GameId — the shapes below are
 * shared, the contents are not.
 */

/** XP needed for level n: XP_PER_LEVEL·(n−1)². Level 2 at 600, level 5 at 9600. */
export const XP_PER_LEVEL = 600

/**
 * What kind of rounds these have been.
 *
 * Everything here is a sum, a maximum or a set. A profile saved before a field
 * existed reads back as zero and starts counting from where it stands — nothing
 * is lost, and nothing pretends to have happened.
 */
export interface Stats {
    /** longest run of correct answers in a row, across all rounds */
    bestStreak: number
    /** rounds finished without a single mistake */
    flawless: number
    totalCorrect: number
    totalMistakes: number
    /**
     * Free-form tallies: rounds per difficulty, per mode, per region — whatever
     * the game counts. One flat map instead of a field per axis, because a game
     * that starts counting something new should not need a change here.
     */
    counters: Record<string, number>
    /** Things done at least once, merged as a set union. */
    tags: string[]
}

export interface Progress {
    xp: number
    plays: number
    /** an opaque, game-chosen key → the best score ever scored under it */
    best: Record<string, number>
    stats: Stats
}

export const EMPTY_STATS: Stats = {
    bestStreak: 0,
    flawless: 0,
    totalCorrect: 0,
    totalMistakes: 0,
    counters: {},
    tags: [],
}

export const EMPTY_PROGRESS: Progress = { xp: 0, plays: 0, best: {}, stats: EMPTY_STATS }

/* ------------------------------------------------------------------ levels -- */

export function levelFromXp(xp: number): number {
    return Math.floor(Math.sqrt(Math.max(0, xp) / XP_PER_LEVEL)) + 1
}

export function xpForLevel(level: number): number {
    return XP_PER_LEVEL * (level - 1) ** 2
}

export interface LevelProgress {
    level: number
    /** XP earned inside the current level */
    into: number
    /** XP the current level takes to finish */
    need: number
    /** 0–100 */
    pct: number
}

export function levelProgress(xp: number): LevelProgress {
    const level = levelFromXp(xp)
    const floor = xpForLevel(level)
    const ceiling = xpForLevel(level + 1)
    const into = xp - floor
    const need = ceiling - floor
    return { level, into, need, pct: need ? Math.round((into / need) * 100) : 0 }
}

/* ------------------------------------------------------------------ merging -- */

function mergeCounts<T extends Record<string, number>>(a: T, b: T): T {
    const merged: Record<string, number> = { ...a }
    for (const [key, value] of Object.entries(b)) {
        merged[key] = Math.max(merged[key] ?? 0, value)
    }
    return merged as T
}

function sumCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const merged: Record<string, number> = { ...a }
    for (const [key, value] of Object.entries(b)) {
        merged[key] = (merged[key] ?? 0) + value
    }
    return merged
}

/**
 * Combines two profiles without either losing anything.
 *
 * `best` takes the maximum, because a record is a maximum. The counters take
 * the maximum too, NOT the sum: the two sides usually overlap — the same device
 * that played the rounds is syncing them up — and adding them would count the
 * same round twice on every sync. Taking the larger under-counts a genuinely
 * split history (rounds played on two devices while both were offline), which
 * is the safe direction to be wrong in: a number that is too low can still be
 * grown by playing, one that is too high is a lie that compounds.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
    return {
        xp: Math.max(a.xp, b.xp),
        plays: Math.max(a.plays, b.plays),
        best: mergeCounts(a.best, b.best),
        stats: {
            bestStreak: Math.max(a.stats.bestStreak, b.stats.bestStreak),
            flawless: Math.max(a.stats.flawless, b.stats.flawless),
            totalCorrect: Math.max(a.stats.totalCorrect, b.stats.totalCorrect),
            totalMistakes: Math.max(a.stats.totalMistakes, b.stats.totalMistakes),
            counters: mergeCounts(a.stats.counters, b.stats.counters),
            tags: Array.from(new Set([...a.stats.tags, ...b.stats.tags])),
        },
    }
}

/** Fills in what an older saved profile did not have. Never throws. */
export function normalizeProgress(raw: unknown): Progress {
    const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Progress>
    const stats = (value.stats ?? {}) as Partial<Stats>
    const count = (n: unknown): number =>
        typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0
    const countMap = (m: unknown): Record<string, number> => {
        const out: Record<string, number> = {}
        if (typeof m === 'object' && m !== null && !Array.isArray(m)) {
            for (const [k, v] of Object.entries(m)) out[k] = count(v)
        }
        return out
    }
    return {
        xp: count(value.xp),
        plays: count(value.plays),
        best: countMap(value.best),
        stats: {
            bestStreak: count(stats.bestStreak),
            flawless: count(stats.flawless),
            totalCorrect: count(stats.totalCorrect),
            totalMistakes: count(stats.totalMistakes),
            counters: countMap(stats.counters),
            tags: Array.isArray(stats.tags)
                ? stats.tags.filter((t): t is string => typeof t === 'string')
                : [],
        },
    }
}

/* -------------------------------------------------------------------- store -- */

/** What one finished round says about itself. */
export interface RunFacts {
    /** the personal-best key this round competes under, e.g. `hard:10` */
    key: string
    score: number
    correctCount?: number
    total?: number
    mistakes?: number
    bestStreak?: number
    /**
     * Whether this counts as a flawless round. Left out, it is derived from
     * mistakes and correctCount — no mistakes, and the round actually finished.
     */
    flawless?: boolean
    /** tallies to bump by one, e.g. `{ difficulty: 'hard', outcome: 'win' }` */
    counters?: Record<string, string>
    /** things now done at least once */
    tags?: string[]
}

/** What changed because of it. */
export interface RunResult {
    previousBest: number
    isRecord: boolean
    levelBefore: number
    levelAfter: number
    leveledUp: boolean
    xp: number
    gainedXp: number
}

export interface ProgressStore {
    get: () => Progress
    /** Records a finished round and says what changed. */
    record: (facts: RunFacts) => RunResult
    bestFor: (key: string) => number
    /** Highest score under any key starting with this prefix. */
    bestWithPrefix: (prefix: string) => number
    level: () => LevelProgress
    /**
     * Folds in what the account had, and remembers whose profile this is.
     * Returns the merged profile, already saved.
     */
    adoptRemote: (username: string, remote: Progress | null) => Progress
    /** Forgets the in-memory copy — call when stored data is cleared. */
    forget: () => void
}

export interface ProgressStoreOptions {
    game: GameId
    /** Reads a stored string, or null. Should respect the game's consent gate. */
    read: (key: string) => string | null
    /** Writes a stored string. Should respect the game's consent gate. */
    write: (key: string, value: string) => void
}

/**
 * Creates the profile store for one game.
 *
 * Storage is injected rather than imported: every repo has its own consent
 * module, and this file is vendored into all of them, so it cannot import any
 * one of them. The keys are namespaced by game so two games in the same origin
 * — which is exactly what spillarena.no is — never read each other's profile.
 */
export function createProgressStore(options: ProgressStoreOptions): ProgressStore {
    const { game, read, write } = options
    const STORAGE_KEY = `spillarena.progress.${game}`
    const OWNER_KEY = `spillarena.progressOwner.${game}`

    /** Kept in memory so a declined consent still gives a working session. */
    let session: Progress | null = null

    const get = (): Progress => {
        if (session) return session
        try {
            const raw = read(STORAGE_KEY)
            session = raw ? normalizeProgress(JSON.parse(raw)) : { ...EMPTY_PROGRESS }
        } catch {
            // a corrupt profile starts over rather than breaking the game
            session = { ...EMPTY_PROGRESS }
        }
        return session
    }

    const save = (progress: Progress): void => {
        session = progress
        try {
            write(STORAGE_KEY, JSON.stringify(progress))
        } catch {
            // a full or blocked store must not cost the player their round
        }
    }

    const record = (facts: RunFacts): RunResult => {
        const progress = get()
        const previousBest = progress.best[facts.key] ?? 0
        const levelBefore = levelFromXp(progress.xp)
        const gainedXp = Math.max(0, Math.round(facts.score))
        const xp = progress.xp + gainedXp
        const levelAfter = levelFromXp(xp)

        const correctCount = facts.correctCount ?? 0
        const mistakes = facts.mistakes ?? 0
        const finished = facts.total === undefined || correctCount === facts.total
        const flawless = facts.flawless ?? (mistakes === 0 && finished)

        const before = progress.stats
        const bumped: Record<string, number> = {}
        for (const [axis, bucket] of Object.entries(facts.counters ?? {})) {
            bumped[`${axis}:${bucket}`] = 1
        }

        save({
            xp,
            plays: progress.plays + 1,
            best: { ...progress.best, [facts.key]: Math.max(previousBest, facts.score) },
            stats: {
                bestStreak: Math.max(before.bestStreak, facts.bestStreak ?? 0),
                flawless: before.flawless + (flawless ? 1 : 0),
                totalCorrect: before.totalCorrect + correctCount,
                totalMistakes: before.totalMistakes + mistakes,
                counters: sumCounts(before.counters, bumped),
                tags: Array.from(new Set([...before.tags, ...(facts.tags ?? [])])),
            },
        })

        return {
            previousBest,
            isRecord: facts.score > previousBest,
            levelBefore,
            levelAfter,
            leveledUp: levelAfter > levelBefore,
            xp,
            gainedXp,
        }
    }

    return {
        get,
        record,
        bestFor: (key) => get().best[key] ?? 0,
        bestWithPrefix: (prefix) =>
            Object.entries(get().best)
                .filter(([key]) => key.startsWith(prefix))
                .reduce((max, [, value]) => Math.max(max, value), 0),
        level: () => levelProgress(get().xp),
        forget: () => {
            session = null
        },

        /**
         * Folds the account's copy into this device's.
         *
         * The owner check is the part that is easy to miss: without it, signing
         * in as someone else on a shared device would merge the previous
         * player's XP into the new account, permanently. A device whose profile
         * belongs to a different account starts from empty instead — the other
         * player's profile is safe on their own account, which is the whole
         * point of having one.
         */
        adoptRemote: (username, remote) => {
            const owner = ((): string | null => {
                try {
                    return read(OWNER_KEY) || null
                } catch {
                    return null
                }
            })()
            const local = owner === null || owner === username ? get() : { ...EMPTY_PROGRESS }
            const merged = remote ? mergeProgress(local, normalizeProgress(remote)) : local
            save(merged)
            try {
                write(OWNER_KEY, username)
            } catch {
                // see save(): storage failures are not worth losing a round over
            }
            return merged
        },
    }
}
