import type { Entry } from './leaderboard'
import type { Mode, Pace } from './types'

/**
 * Klient mot den globale ledertavla (Cloudflare Pages Function + D1).
 *
 * Alt her feiler stille: uten nett, uten API eller med en treg server faller
 * spillet tilbake på den lokale tavla. En runde skal aldri gå tapt fordi
 * skyen ikke svarte.
 */

const TIMEOUT_MS = 6000

/** Pages Functions ligger under samme prefiks som appen; rot er reserven. */
const API_PATHS = [`${import.meta.env.BASE_URL}api/leaderboard`, '/api/leaderboard']

export interface CloudEntry {
  id: string
  timestamp: string
  username: string
  category: string
  region: string
  mode: Mode
  pace: Pace
  score: number
  correctCount: number
  total: number
  mistakes: number
  bestStreak: number
  elapsedMs: number
  /** hvilke poengregler resultatet ble regnet etter — se game/scoring.ts */
  scoringVersion?: number
}

/** Oversetter en skyoppføring til samme form som de lokale radene. */
export function toEntry(cloud: CloudEntry): Entry {
  return {
    id: cloud.id,
    name: cloud.username,
    score: cloud.score,
    categoryId: cloud.category,
    regionId: cloud.region,
    mode: cloud.mode,
    pace: cloud.pace,
    correctCount: cloud.correctCount,
    total: cloud.total,
    mistakes: cloud.mistakes,
    bestStreak: cloud.bestStreak,
    elapsedMs: cloud.elapsedMs,
    scoringVersion: cloud.scoringVersion,
    date: Date.parse(cloud.timestamp) || Date.now(),
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(path, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Prøver hver kjente API-sti til én svarer. 404 betyr «feil sti», så da går
 * vi videre til neste; andre feil regnes som at tjenesten er nede.
 */
async function callApi(query: string, init?: RequestInit): Promise<unknown | null> {
  for (const base of API_PATHS) {
    try {
      const response = await request(`${base}${query}`, init)
      if (response.status === 404) continue
      if (!response.ok) return null
      return await response.json()
    } catch {
      continue
    }
  }
  return null
}

/**
 * Henter den globale toppen. Returnerer null når tavla ikke er tilgjengelig.
 *
 * `regionId` uten `categoryId` gir hele regionens tavle på tvers av
 * kategorier — det er den visningen dashbordet bruker. `mode` snevrer inn til
 * én spillmodus: modusene er ikke like mye verdt, så en blandet tavle
 * rangerer ikke like øvelser mot hverandre.
 */
export async function fetchGlobalEntries(
  regionId?: string,
  categoryId?: string,
  mode?: string,
  limit = 25,
): Promise<Entry[] | null> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (categoryId && categoryId !== 'all') params.set('category', categoryId)
  if (regionId && regionId !== 'all') params.set('region', regionId)
  if (mode && mode !== 'all') params.set('mode', mode)

  const data = (await callApi(`?${params}`)) as { entries?: CloudEntry[] } | null
  if (!data?.entries) return null
  return data.entries.map(toEntry)
}

export interface SubmitPayload {
  username: string
  category: string
  region: string
  mode: Mode
  pace: Pace
  score: number
  correctCount: number
  total: number
  mistakes: number
  bestStreak: number
  elapsedMs: number
}

/** Sender inn et resultat. `false` betyr at det bare ble lagret lokalt. */
export async function submitScore(payload: SubmitPayload): Promise<boolean> {
  const data = await callApi('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return data !== null
}
