import { readPreference, writePreference } from '../lib/cookieConsent'
import type { Mode, Pace } from './types'

const SCORES_KEY = 'leaderboard'
const NAME_KEY = 'playerName'
const MAX_ENTRIES = 200

export interface Entry {
  id: string
  name: string
  score: number
  categoryId: string
  /** hvilken region runden ble spilt i */
  regionId: string
  mode: Mode
  correctCount: number
  total: number
  mistakes: number
  elapsedMs: number
  date: number
  /** lengste rekke riktige på rad (mangler på oppføringer fra før combo-systemet) */
  bestStreak?: number
  /** tempoet runden ble spilt på (mangler på eldre oppføringer) */
  pace?: Pace
  /**
   * Hvilke poengregler resultatet ble regnet etter — se game/scoring.ts.
   * Mangler på oppføringer fra før modusene fikk hver sin verdi.
   */
  scoringVersion?: number
}

/**
 * Uten samtykke lagres ingenting på enheten — men navn og resultater lever
 * videre i minnet, så runden og ledertavla fungerer ut økten.
 */
let sessionName: string | null = null
let sessionEntries: Entry[] | null = null

export function getName(): string {
  if (sessionName !== null) return sessionName
  sessionName = readPreference(NAME_KEY) ?? ''
  return sessionName
}

export function setName(name: string): void {
  sessionName = name
  writePreference(NAME_KEY, name)
}

export function getEntries(): Entry[] {
  if (sessionEntries) return sessionEntries
  try {
    const raw = readPreference(SCORES_KEY)
    const parsed = raw ? (JSON.parse(raw) as Entry[]) : []
    // oppføringer lagret før regionene fantes er alltid norske runder
    sessionEntries = parsed.map((e) => ({ ...e, regionId: e.regionId ?? 'norway' }))
  } catch {
    sessionEntries = []
  }
  return sessionEntries
}

export function addEntry(entry: Omit<Entry, 'id' | 'date'>): Entry {
  const full: Entry = { ...entry, id: crypto.randomUUID(), date: Date.now() }
  const entries = [...getEntries(), full]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES)
  sessionEntries = entries
  writePreference(SCORES_KEY, JSON.stringify(entries))
  return full
}

/** Glemmer navn og resultater i minnet — kalles når lagrede data slettes. */
export function forgetLeaderboard(): void {
  sessionName = null
  sessionEntries = null
}
