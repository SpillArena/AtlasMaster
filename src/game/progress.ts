import { readPreference, writePreference } from '../lib/cookieConsent'
import type { Mode, Pace } from './types'
import type { Rank } from './rank'
import { earnedBadgeIds } from './badges'

/**
 * Spillerprofil: samlet XP (= sum av alle poengsummer), antall runder,
 * personlig rekord per kategori+modus, og en liten logg over hva slags runder
 * det faktisk har vært. Brukes til nivåmerket i headeren, «ny rekord»-blinket
 * på resultatskjermen, og merkene i profilen.
 */

const STORAGE_KEY = 'progress'
/** XP for å nå nivå n: 600·(n−1)² — nivå 2 på 600, nivå 5 på 9600. */
const XP_PER_LEVEL = 600

/**
 * Hva slags runder det har vært.
 *
 * Merkene i profilen spør om ting én poengsum ikke kan svare på — har du spilt
 * alle regionene, har du hatt en runde uten et eneste bomskudd, hvor lang har
 * den lengste rekka vært. Alt her er summer og tellinger som bare vokser, så
 * en profil fra før dette fantes leses inn med nuller og begynner å telle fra
 * der den står; ingenting går tapt, og ingenting later som det har skjedd.
 */
export interface Stats {
  /** lengste rekke riktige på rad, gjennom alle runder */
  bestStreak: number
  /** runder uten et eneste bomskudd */
  flawless: number
  /** runder med toppkarakter */
  topRanks: number
  totalCorrect: number
  totalMistakes: number
  /** spilte runder per region, modus og tempo */
  byRegion: Record<string, number>
  byMode: Partial<Record<Mode, number>>
  byPace: Partial<Record<Pace, number>>
  /** `${regionId}:${categoryId}` som er spilt minst én gang */
  categoriesPlayed: string[]
}

export interface Progress {
  xp: number
  plays: number
  /** `${regionId}:${categoryId}:${mode}` → beste poengsum */
  best: Record<string, number>
  stats: Stats
}

const EMPTY_STATS: Stats = {
  bestStreak: 0,
  flawless: 0,
  topRanks: 0,
  totalCorrect: 0,
  totalMistakes: 0,
  byRegion: {},
  byMode: {},
  byPace: {},
  categoriesPlayed: [],
}

const EMPTY: Progress = { xp: 0, plays: 0, best: {}, stats: EMPTY_STATS }

/** Fyller ut det en eldre lagret profil ikke hadde. */
function withStats(raw: Partial<Stats> | undefined): Stats {
  return {
    ...EMPTY_STATS,
    ...raw,
    byRegion: { ...(raw?.byRegion ?? {}) },
    byMode: { ...(raw?.byMode ?? {}) },
    byPace: { ...(raw?.byPace ?? {}) },
    categoriesPlayed: [...(raw?.categoriesPlayed ?? [])],
  }
}

/**
 * Rekordnøklene var `${categoryId}:${mode}` før regionene fantes. Slike
 * nøkler er per definisjon norske runder, så de får `norway:` foran seg ved
 * innlesing. Uten dette ville hver personlige rekord se ut som null første
 * gang spilleren åpner den nye versjonen.
 */
function migrateBestKeys(best: Record<string, number>): Record<string, number> {
  const migrated: Record<string, number> = {}
  for (const [key, value] of Object.entries(best)) {
    const full = key.split(':').length === 2 ? `norway:${key}` : key
    migrated[full] = Math.max(migrated[full] ?? 0, value)
  }
  return migrated
}

/** Holder profilen i live for økten når samtykke er avslått. */
let session: Progress | null = null

export function getProgress(): Progress {
  if (session) return session
  try {
    const raw = readPreference(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Progress>
      session = {
        xp: parsed.xp ?? 0,
        plays: parsed.plays ?? 0,
        best: migrateBestKeys(parsed.best ?? {}),
        stats: withStats(parsed.stats),
      }
      return session
    }
  } catch {
    /* ødelagt profil — start på nytt */
  }
  session = { ...EMPTY, best: {}, stats: withStats(undefined) }
  return session
}

function save(progress: Progress): void {
  session = progress
  writePreference(STORAGE_KEY, JSON.stringify(progress))
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / XP_PER_LEVEL)) + 1
}

export function xpForLevel(level: number): number {
  return XP_PER_LEVEL * (level - 1) ** 2
}

export interface LevelProgress {
  level: number
  /** XP samlet inn på nåværende nivå */
  into: number
  /** XP som kreves for å fullføre nåværende nivå */
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

function bestKey(regionId: string, categoryId: string, mode: Mode): string {
  return `${regionId}:${categoryId}:${mode}`
}

export function bestFor(regionId: string, categoryId: string, mode: Mode): number {
  return getProgress().best[bestKey(regionId, categoryId, mode)] ?? 0
}

/** Høyeste poengsum i kategorien uansett modus — vises på kategori-flisa. */
export function bestForCategory(regionId: string, categoryId: string): number {
  const { best } = getProgress()
  return Object.entries(best)
    .filter(([key]) => key.startsWith(`${regionId}:${categoryId}:`))
    .reduce((max, [, value]) => Math.max(max, value), 0)
}

/** Høyeste poengsum i hele regionen — vises på regionflisa. */
export function bestForRegion(regionId: string): number {
  const { best } = getProgress()
  return Object.entries(best)
    .filter(([key]) => key.startsWith(`${regionId}:`))
    .reduce((max, [, value]) => Math.max(max, value), 0)
}

export interface RunResult {
  previousBest: number
  isRecord: boolean
  levelBefore: number
  levelAfter: number
  leveledUp: boolean
  xp: number
  /** merker som ble låst opp av nettopp denne runden */
  earned: string[]
}

/** Alt en fullført runde forteller om seg selv. */
export interface RunFacts {
  regionId: string
  categoryId: string
  mode: Mode
  pace: Pace
  score: number
  correctCount: number
  total: number
  mistakes: number
  bestStreak: number
  rank: Rank
}

/** Registrerer en fullført runde og returnerer hva som endret seg. */
export function recordRun(facts: RunFacts): RunResult {
  const { regionId, categoryId, mode, pace, score } = facts
  const progress = getProgress()
  const key = bestKey(regionId, categoryId, mode)
  const previousBest = progress.best[key] ?? 0
  const levelBefore = levelFromXp(progress.xp)
  const xp = progress.xp + Math.max(0, score)
  const levelAfter = levelFromXp(xp)

  const before = progress.stats
  const categoryKey = `${regionId}:${categoryId}`
  const stats: Stats = {
    bestStreak: Math.max(before.bestStreak, facts.bestStreak),
    // «uten et eneste bomskudd» betyr også at runden faktisk ble fullført
    flawless: before.flawless + (facts.mistakes === 0 && facts.correctCount === facts.total ? 1 : 0),
    topRanks: before.topRanks + (facts.rank === 'S' ? 1 : 0),
    totalCorrect: before.totalCorrect + facts.correctCount,
    totalMistakes: before.totalMistakes + facts.mistakes,
    byRegion: { ...before.byRegion, [regionId]: (before.byRegion[regionId] ?? 0) + 1 },
    byMode: { ...before.byMode, [mode]: (before.byMode[mode] ?? 0) + 1 },
    byPace: { ...before.byPace, [pace]: (before.byPace[pace] ?? 0) + 1 },
    categoriesPlayed: before.categoriesPlayed.includes(categoryKey)
      ? before.categoriesPlayed
      : [...before.categoriesPlayed, categoryKey],
  }

  const next: Progress = {
    xp,
    plays: progress.plays + 1,
    best: { ...progress.best, [key]: Math.max(previousBest, score) },
    stats,
  }
  save(next)

  return {
    previousBest,
    isRecord: score > previousBest,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    xp,
    earned: newlyEarned(progress, next),
  }
}

/**
 * Merker denne runden låste opp.
 *
 * Regnes ut som differansen mellom før og etter, ikke lagret som en liste.
 * Et merke er en påstand om profilen — «du har spilt alle regionene» — og en
 * påstand skal utledes av tilstanden, ikke vedlikeholdes ved siden av den, der
 * de to kan komme i utakt.
 */
function newlyEarned(before: Progress, after: Progress): string[] {
  // importeres her for å bryte en syklus: badges leser Progress
  const had = new Set(earnedBadgeIds(before))
  return earnedBadgeIds(after).filter((id) => !had.has(id))
}

/** Glemmer profilen i minnet — kalles når lagrede data slettes. */
export function forgetProgress(): void {
  session = null
}

const OWNER_KEY = 'progressOwner'

/**
 * Hvilken konto den lokale profilen sist ble synkronisert mot — `null` for en
 * profil som enten er gjestespilt eller aldri har møtt en konto.
 *
 * Dette er IKKE det samme som å være innlogget nå. Det er et spor etter SIST
 * gang enheten snakket med en konto, og det eneste stedet det brukes er
 * `adoptRemoteProgress` under: uten det ville et kontobytte på samme enhet
 * limt den forrige spillerens statistikk inn i den neste sin. Se
 * game/profileSync.ts for hele historien.
 */
export function getProgressOwner(): string | null {
  return readPreference(OWNER_KEY) || null
}

function setProgressOwner(username: string): void {
  writePreference(OWNER_KEY, username)
}

/**
 * Smelter to profiler sammen uten å la noen av dem tape noe.
 *
 * Alt i `Stats` er en sum eller en telling som bare vokser (se kommentaren på
 * typen) — det samme gjelder XP, antall runder og hver personlige rekord i
 * `best`. Å ta det høyeste av hvert par, felt for felt, er derfor både trygt
 * og idempotent: et kall som kommer for sent, eller to ganger, gjør aldri
 * profilen dårligere enn den var. Det er nøyaktig samme idé som
 * `migrateBestKeys` bruker på én record allerede — her gjelder den hele
 * profilen.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  return {
    xp: Math.max(a.xp, b.xp),
    plays: Math.max(a.plays, b.plays),
    best: mergeCounts(a.best, b.best),
    stats: {
      bestStreak: Math.max(a.stats.bestStreak, b.stats.bestStreak),
      flawless: Math.max(a.stats.flawless, b.stats.flawless),
      topRanks: Math.max(a.stats.topRanks, b.stats.topRanks),
      totalCorrect: Math.max(a.stats.totalCorrect, b.stats.totalCorrect),
      totalMistakes: Math.max(a.stats.totalMistakes, b.stats.totalMistakes),
      byRegion: mergeCounts(a.stats.byRegion, b.stats.byRegion),
      byMode: mergeCounts(a.stats.byMode, b.stats.byMode),
      byPace: mergeCounts(a.stats.byPace, b.stats.byPace),
      categoriesPlayed: Array.from(
        new Set([...a.stats.categoriesPlayed, ...b.stats.categoriesPlayed]),
      ),
    },
  }
}

function mergeCounts(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a }
  for (const [key, value] of Object.entries(b)) {
    out[key] = Math.max(out[key] ?? 0, value)
  }
  return out
}

/**
 * Tar imot det kontoen har liggende, og gjør opp med hvem enhetens profil
 * faktisk tilhører før den smeltes inn.
 *
 * Samme konto (eller ingen kjent eier — en gjest som nettopp logget inn eller
 * registrerte seg): den lokale profilen er fortsatt spillerens egen, og
 * smeltes sammen med kontoens som vanlig — se `mergeProgress`.
 *
 * En ANNEN konto satt sist: enheten sin profil hørte til noen andre, og skal
 * ikke bli en gratis gave til den som nettopp logget inn her. Den nye kontoen
 * starter fra sitt eget, tomme utgangspunkt i stedet — akkurat som om
 * enheten var blank.
 */
export function adoptRemoteProgress(username: string, remote: Progress | null): Progress {
  const owner = getProgressOwner()
  const local = owner === null || owner === username ? getProgress() : EMPTY
  const merged = remote ? mergeProgress(local, remote) : local
  save(merged)
  setProgressOwner(username)
  return merged
}
