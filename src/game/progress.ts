import { readPreference, writePreference } from '../lib/cookieConsent'
import type { Mode } from './types'

/**
 * Spillerprofil: samlet XP (= sum av alle poengsummer), antall runder og
 * personlig rekord per kategori+modus. Brukes til nivåmerket i headeren og
 * «ny rekord»-blinket på resultatskjermen.
 */

const STORAGE_KEY = 'progress'
/** XP for å nå nivå n: 600·(n−1)² — nivå 2 på 600, nivå 5 på 9600. */
const XP_PER_LEVEL = 600

export interface Progress {
  xp: number
  plays: number
  /** `${categoryId}:${mode}` → beste poengsum */
  best: Record<string, number>
}

const EMPTY: Progress = { xp: 0, plays: 0, best: {} }

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
        best: parsed.best ?? {},
      }
      return session
    }
  } catch {
    /* ødelagt profil — start på nytt */
  }
  session = { ...EMPTY, best: {} }
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

function bestKey(categoryId: string, mode: Mode): string {
  return `${categoryId}:${mode}`
}

export function bestFor(categoryId: string, mode: Mode): number {
  return getProgress().best[bestKey(categoryId, mode)] ?? 0
}

/** Høyeste poengsum i kategorien uansett modus — vises på kategori-flisa. */
export function bestForCategory(categoryId: string): number {
  const { best } = getProgress()
  return Object.entries(best)
    .filter(([key]) => key.startsWith(`${categoryId}:`))
    .reduce((max, [, value]) => Math.max(max, value), 0)
}

export interface RunResult {
  previousBest: number
  isRecord: boolean
  levelBefore: number
  levelAfter: number
  leveledUp: boolean
  xp: number
}

/** Registrerer en fullført runde og returnerer hva som endret seg. */
export function recordRun(categoryId: string, mode: Mode, score: number): RunResult {
  const progress = getProgress()
  const key = bestKey(categoryId, mode)
  const previousBest = progress.best[key] ?? 0
  const levelBefore = levelFromXp(progress.xp)
  const xp = progress.xp + Math.max(0, score)
  const levelAfter = levelFromXp(xp)

  save({
    xp,
    plays: progress.plays + 1,
    best: { ...progress.best, [key]: Math.max(previousBest, score) },
  })

  return {
    previousBest,
    isRecord: score > previousBest,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    xp,
  }
}

/** Glemmer profilen i minnet — kalles når lagrede data slettes. */
export function forgetProgress(): void {
  session = null
}
