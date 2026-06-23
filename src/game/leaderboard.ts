import type { Mode } from './types'

const SCORES_KEY = 'leaderboard'
const NAME_KEY = 'playerName'
const MAX_ENTRIES = 200

export interface Entry {
  id: string
  name: string
  score: number
  categoryId: string
  mode: Mode
  correctCount: number
  total: number
  mistakes: number
  elapsedMs: number
  date: number
}

/**
 * Total score: 100 poeng per riktige + tidsbonus om man er raskere enn
 * normtid (5 s per mål), skalert med treffandel. Feil/oppgitt gir 0 poeng.
 */
export function scoreFor(
  correctCount: number,
  total: number,
  elapsedMs: number,
): number {
  const base = correctCount * 100
  const idealSec = total * 5
  const elapsedSec = elapsedMs / 1000
  const timeBonus = Math.max(0, Math.round((idealSec - elapsedSec) * 3))
  const ratio = total ? correctCount / total : 0
  return base + Math.round(timeBonus * ratio)
}

export function getName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    /* ignore */
  }
}

export function getEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY)
    return raw ? (JSON.parse(raw) as Entry[]) : []
  } catch {
    return []
  }
}

export function addEntry(entry: Omit<Entry, 'id' | 'date'>): Entry {
  const full: Entry = { ...entry, id: crypto.randomUUID(), date: Date.now() }
  const entries = [...getEntries(), full]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(entries))
  } catch {
    /* ignore */
  }
  return full
}
