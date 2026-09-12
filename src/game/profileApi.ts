import { getSession, signOut } from './auth'
import { callApi, type ApiResult } from './apiClient'
import type { Progress } from './progress'

/**
 * Klient mot profil-lagringen (Cloudflare Pages Function + D1).
 *
 * Samme filosofi som scoreApi.ts: alt her feiler stille. Profilen virker fra
 * enheten uansett — se game/progress.ts — denne synker den bare opp mot
 * kontoen når nettet og tjeneren samarbeider. Se game/profileSync.ts for hvem
 * som faktisk kaller disse to, og hvorfor.
 */
const API_PATHS = [`${import.meta.env.BASE_URL}api/profile`, '/api/profile']

export interface CloudProgress {
  progress: Progress | null
  updatedAt: string | null
}

/** Henter profilen kontoen har lagret, eller `null` om den aldri har synkronisert noe. */
export async function fetchProfile(): Promise<ApiResult<CloudProgress>> {
  const session = getSession()
  if (!session) return { ok: false, reason: 'rejected', status: 401, message: 'Not signed in' }

  const result = await callApi<CloudProgress>(API_PATHS, '', {
    headers: { Authorization: `Bearer ${session.token}` },
  })
  // et tegn kan ha gått ut mens fanen stod åpen; da er økten over
  if (!result.ok && result.reason === 'rejected' && result.status === 401) signOut()
  return result
}

/** Skriver profilen til kontoen — full erstatning, ikke en diff. */
export async function pushProfile(progress: Progress): Promise<ApiResult<{ updatedAt: string }>> {
  const session = getSession()
  if (!session) return { ok: false, reason: 'rejected', status: 401, message: 'Not signed in' }

  const result = await callApi<{ updatedAt: string }>(API_PATHS, '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(progress),
  })
  if (!result.ok && result.reason === 'rejected' && result.status === 401) signOut()
  return result
}
