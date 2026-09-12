import { getSession, signOut } from './auth'
import { callApi, type ApiResult } from './apiClient'
import type { Entry } from './leaderboard'
import type { Mode, Pace } from './types'

/**
 * Klient mot den globale ledertavla (Cloudflare Pages Function + D1).
 *
 * Alt her feiler stille: uten nett, uten API eller med en treg server faller
 * spillet tilbake på den lokale tavla. En runde skal aldri gå tapt fordi
 * skyen ikke svarte. Selve oppslaget — stiene, tidsavbruddet, skillet mellom
 * død tjener og avvist kall — er delt med profilen i apiClient.ts.
 */

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

export interface BoardQuery {
  regionId?: string
  categoryId?: string
  mode?: string
  /** rolig, normal eller lyn — 'all' blander dem */
  pace?: string
  limit?: number
}

/**
 * Henter den globale toppen, sortert høyest først.
 *
 * `regionId` uten `categoryId` gir hele regionens tavle på tvers av
 * kategorier; `'all'` for begge gir tavla på tvers av alle regioner. `mode` og
 * `pace` snevrer inn til én øvelse — verken modusene eller tempoene er like
 * mye verdt, så en blandet tavle rangerer ikke like ting mot hverandre.
 */
export async function fetchGlobalEntries(
  query: BoardQuery = {},
): Promise<ApiResult<Entry[]>> {
  const { regionId, categoryId, mode, pace, limit = 25 } = query
  const params = new URLSearchParams({ limit: String(limit) })
  if (categoryId && categoryId !== 'all') params.set('category', categoryId)
  if (regionId && regionId !== 'all') params.set('region', regionId)
  if (mode && mode !== 'all') params.set('mode', mode)
  if (pace && pace !== 'all') params.set('pace', pace)

  const result = await callApi<{ entries?: CloudEntry[] }>(API_PATHS, `?${params}`)
  if (!result.ok) return result
  return { ok: true, data: (result.data.entries ?? []).map(toEntry) }
}

export interface SubmitPayload {
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

/**
 * Sender inn et resultat, og får plasseringen tilbake.
 *
 * Svaret bar en full, oppdatert tavle før — beregnet med et ekstra oppslag på
 * serveren, og kastet av kaller-siden, som bare så etter om det kom noe i det
 * hele tatt. Nå bærer det plassen runden fikk, som er det spilleren lurer på.
 */
export async function submitScore(
  payload: SubmitPayload,
): Promise<ApiResult<{ rank: number | null }>> {
  const session = getSession()
  if (!session) return { ok: false, reason: 'rejected', status: 401, message: 'Not signed in' }

  const result = await callApi<{ rank?: number | null }>(API_PATHS, '', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // navnet kommer fra tegnet, ikke fra kroppen — se functions/api/auth/
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify(payload),
  })

  // et tegn kan ha gått ut mens fanen stod åpen; da er økten over
  if (!result.ok && result.reason === 'rejected' && result.status === 401) signOut()
  if (!result.ok) return result
  return { ok: true, data: { rank: result.data.rank ?? null } }
}
