/**
 * Profilen lagret på kontoen: XP, nivå, personlige rekorder og statistikk.
 *
 * GET  /api/profile  → 200 { progress: Progress | null, updatedAt: string | null }
 * POST /api/profile   { ...Progress }  → 200 { updatedAt }
 *
 * Alt dette lever på enheten fra før — se src/game/progress.ts — og spillet
 * virker uten denne funksjonen akkurat som det alltid har gjort. Det den gjør
 * er å speile det samme dokumentet til kontoen, slik at det overlever
 * enhetsbytte og nettleserrydding. Se migrations/0006_create_player_progress.sql
 * for hvorfor det er én JSON-kolonne og ikke ett sett kolonner.
 *
 * Samme identitetsregel som ledertavla: brukernavnet kommer fra det signerte
 * tegnet, aldri fra kroppen. Se functions/api/auth/.
 */

import { verifyToken } from '../auth/index.js'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

/*
 * Grensene her er ikke satt mot juks — det er ingen tavle å jukse på, profilen
 * er privat for kontoen selv. De er mot en klient med en feil, eller en
 * ondsinnet kropp, som ellers kunne blåst opp raden i det uendelige: hver
 * nøkkel i `best` er ett svar spilt minst én gang, og spillet er ikke i
 * nærheten av tusen kategori+modus-kombinasjoner.
 */
const MAX_ENTRIES = 2000
const MAX_KEY_LEN = 64
const MAX_ARRAY_LEN = 2000
const MAX_NUMBER = 1e9
const MAX_BODY_BYTES = 200_000

function isCount(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= MAX_NUMBER
}

/** Et objekt streng → ikke-negativt tall, med et tak på både antall nøkler og nøkkellengde. */
function isCountMap(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false
  const keys = Object.keys(obj)
  if (keys.length > MAX_ENTRIES) return false
  return keys.every((k) => k.length <= MAX_KEY_LEN && isCount(obj[k]))
}

function isStringArray(arr) {
  return (
    Array.isArray(arr) &&
    arr.length <= MAX_ARRAY_LEN &&
    arr.every((s) => typeof s === 'string' && s.length <= MAX_KEY_LEN)
  )
}

/**
 * Formen speiler `Progress` og `Stats` i src/game/progress.ts. Dette er et
 * gulv, ikke en låst kontrakt: et felt som blir lagt til der uten migrasjon
 * her — akkurat slik Stats har fått felt uten migrasjon i localStorage-utgaven
 * — blir liggende uvalidert inntil noen legger til en sjekk for det. Feil vei
 * å bomme er alltid å avvise for mye, aldri å lagre en form vi ikke kjenner.
 */
function validateProgress(raw) {
  if (typeof raw !== 'object' || raw === null) return 'Invalid body'
  if (!isCount(raw.xp)) return 'Invalid xp'
  if (!isCount(raw.plays)) return 'Invalid plays'
  if (!isCountMap(raw.best)) return 'Invalid best'

  const stats = raw.stats
  if (typeof stats !== 'object' || stats === null) return 'Invalid stats'
  if (!isCount(stats.bestStreak)) return 'Invalid stats.bestStreak'
  if (!isCount(stats.flawless)) return 'Invalid stats.flawless'
  if (!isCount(stats.topRanks)) return 'Invalid stats.topRanks'
  if (!isCount(stats.totalCorrect)) return 'Invalid stats.totalCorrect'
  if (!isCount(stats.totalMistakes)) return 'Invalid stats.totalMistakes'
  if (!isCountMap(stats.byRegion)) return 'Invalid stats.byRegion'
  if (!isCountMap(stats.byMode)) return 'Invalid stats.byMode'
  if (!isCountMap(stats.byPace)) return 'Invalid stats.byPace'
  if (!isStringArray(stats.categoriesPlayed)) return 'Invalid stats.categoriesPlayed'

  return null
}

function authenticate(env, request) {
  if (!env.AUTH_SECRET) return { error: json({ error: 'Accounts are not configured on this deployment' }, 503) }
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return { token }
}

export async function onRequestGet(context) {
  const { env, request } = context
  const auth = authenticate(env, request)
  if (auth.error) return auth.error

  const username = await verifyToken(env.AUTH_SECRET, auth.token)
  if (!username) return json({ error: 'Sign in to read a profile' }, 401)

  try {
    const row = await env.DB.prepare(
      `SELECT data, updated_at AS updatedAt FROM player_progress WHERE username = ?`,
    )
      .bind(username)
      .first()
    if (!row) return json({ progress: null, updatedAt: null })
    return json({ progress: JSON.parse(row.data), updatedAt: row.updatedAt })
  } catch (error) {
    return json({ error: 'Failed to load profile', details: String(error) }, 500)
  }
}

export async function onRequestPost(context) {
  const { env, request } = context
  const auth = authenticate(env, request)
  if (auth.error) return auth.error

  const username = await verifyToken(env.AUTH_SECRET, auth.token)
  if (!username) return json({ error: 'Sign in to save a profile' }, 401)

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Body too large' }, 413)

  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const invalid = validateProgress(body)
  if (invalid) return json({ error: invalid }, 400)

  const updatedAt = new Date().toISOString()
  try {
    await env.DB.prepare(
      `INSERT INTO player_progress (username, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
      .bind(username, JSON.stringify(body), updatedAt)
      .run()
    return json({ updatedAt })
  } catch (error) {
    return json({ error: 'Failed to save profile', details: String(error) }, 500)
  }
}
