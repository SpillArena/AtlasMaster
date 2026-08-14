/**
 * Global ledertavle for AtlasMaster (Cloudflare Pages Function + D1).
 *
 * GET  /api/leaderboard?region=norway&category=fylker&mode=click&limit=25
 * POST /api/leaderboard — send inn et resultat
 *
 * Poengsummen regnes ut i nettleseren, så den kan ikke stoles blindt på.
 * Derfor avvises alt som ikke kan ha skjedd i et ekte spill: ukjente
 * kategorier/moduser, umulige tellinger og poeng over det teoretiske taket.
 */

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

/**
 * Må speile regionregisteret i src/game/regions.ts. Kategori-id-ene er
 * bevisst ulike per region — «fylker» finnes bare i Norge, «countries» bare
 * i Europa — så et resultat kan ikke sendes inn under feil region.
 */
const REGION_CATEGORIES = {
  norway: new Set(['fylker', 'storbyer', 'elver', 'fjell']),
  europe: new Set(['countries', 'capitals', 'rivers', 'peaks']),
  asia: new Set(['asiaCountries', 'asiaCapitals', 'asiaRivers', 'asiaPeaks']),
  usa: new Set(['usStates', 'usCities', 'usRivers', 'usPeaks']),
}

const MODES = new Set(['click', 'choice', 'type'])
const PACES = new Set(['relaxed', 'normal', 'blitz'])

/*
 * Poengtaket, som speiler src/game/scoring.ts.
 *
 * Denne funksjonen kjører i Cloudflare-runtime og kan ikke importere
 * TypeScript fra klienten, så konstantene står her også. `SCORING_VERSION` er
 * det som holder de to i lås: endres reglene på klienten uten at tallet her
 * følger etter, havner nye resultater i databasen med feil versjon, og det
 * synes.
 */
const SCORING_VERSION = 2
/** Må speile PACE_META i src/game/types.ts. */
const PACE_MULTIPLIER = { relaxed: 0.8, normal: 1, blitz: 1.4 }
/** Må speile MODE_MULTIPLIER i src/game/scoring.ts. */
const MODE_MULTIPLIER = { choice: 0.8, click: 1, type: 1.5 }
/** BASE_POINTS + FAST_BONUS, ganget med maks combo (×2). */
const MAX_POINTS_PER_TARGET = (100 + 60) * 2

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })

const SELECT_COLUMNS = `
    id,
    timestamp,
    username,
    category,
    region,
    mode,
    pace,
    score,
    correct_count AS correctCount,
    total,
    mistakes,
    best_streak AS bestStreak,
    elapsed_ms AS elapsedMs,
    scoring_version AS scoringVersion`

/**
 * Én oppføring per spiller per region+kategori+modus — den beste.
 *
 * `mode` er et eget filter og ikke bare en gruppering: modusene er ikke like
 * mye verdt lenger, så en skriverunde og en klikkerunde i samme kategori er
 * to ulike øvelser. Uten filteret ville skrivemodus ha tatt hele toppen av
 * enhver blandet tavle på multiplikatoren alene.
 */
async function fetchTop(db, region, category, mode, limit) {
  const filters = []
  const binds = []
  if (region) {
    filters.push('region = ?')
    binds.push(region)
  }
  if (category) {
    filters.push('category = ?')
    binds.push(category)
  }
  if (mode) {
    filters.push('mode = ?')
    binds.push(mode)
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  binds.push(limit)

  const { results } = await db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM leaderboard_entries
       ${where}
       GROUP BY username, region, category, mode
       HAVING score = MAX(score)
       ORDER BY score DESC, timestamp DESC, id DESC
       LIMIT ?`,
    )
    .bind(...binds)
    .all()

  return results ?? []
}

function parseEntry(raw) {
  const username = typeof raw.username === 'string' ? raw.username.trim() : ''
  const category = typeof raw.category === 'string' ? raw.category : ''
  const region = typeof raw.region === 'string' ? raw.region : ''
  const mode = typeof raw.mode === 'string' ? raw.mode : ''
  const pace = typeof raw.pace === 'string' ? raw.pace : ''
  const score = Number(raw.score)
  const correctCount = Number(raw.correctCount)
  const total = Number(raw.total)
  const mistakes = Number(raw.mistakes)
  const bestStreak = Number(raw.bestStreak)
  const elapsedMs = Number(raw.elapsedMs)

  if (!username || username.length > 20) return { error: 'Invalid username' }
  if (!Object.hasOwn(REGION_CATEGORIES, region)) return { error: 'Invalid region' }
  if (!REGION_CATEGORIES[region].has(category)) return { error: 'Invalid category' }
  if (!MODES.has(mode)) return { error: 'Invalid mode' }
  if (!PACES.has(pace)) return { error: 'Invalid pace' }
  if (!Number.isInteger(total) || total < 1 || total > 500) return { error: 'Invalid total' }
  if (!Number.isInteger(correctCount) || correctCount < 0 || correctCount > total)
    return { error: 'Invalid correct count' }
  if (!Number.isInteger(mistakes) || mistakes < 0 || mistakes > 10000)
    return { error: 'Invalid mistakes' }
  if (!Number.isInteger(bestStreak) || bestStreak < 0 || bestStreak > total)
    return { error: 'Invalid streak' }
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 6 * 60 * 60 * 1000)
    return { error: 'Invalid duration' }

  const ceiling = Math.ceil(
    total * MAX_POINTS_PER_TARGET * MODE_MULTIPLIER[mode] * PACE_MULTIPLIER[pace],
  )
  if (!Number.isFinite(score) || score < 0 || score > ceiling) return { error: 'Invalid score' }

  return {
    entry: {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      username,
      category,
      region,
      mode,
      pace,
      score: Math.round(score),
      correctCount,
      total,
      mistakes,
      bestStreak,
      elapsedMs,
      // settes av serveren, ikke av klienten: hvilke regler en poengsum er
      // regnet etter er ikke noe innsenderen skal få bestemme
      scoringVersion: SCORING_VERSION,
    },
  }
}

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)
  const regionParam = url.searchParams.get('region')
  const region = Object.hasOwn(REGION_CATEGORIES, regionParam) ? regionParam : null
  const categoryParam = url.searchParams.get('category')
  // en kategori gir bare mening innenfor en region
  const category =
    region && categoryParam && REGION_CATEGORIES[region].has(categoryParam)
      ? categoryParam
      : null
  const modeParam = url.searchParams.get('mode')
  const mode = MODES.has(modeParam) ? modeParam : null
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

  try {
    return json({ entries: await fetchTop(env.DB, region, category, mode, limit) })
  } catch (error) {
    return json({ error: 'Failed to load leaderboard', details: String(error) }, 500)
  }
}

export async function onRequestPost(context) {
  const { env, request } = context

  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = parseEntry(payload)
  if (parsed.error) return json({ error: parsed.error }, 400)
  const entry = parsed.entry

  try {
    await env.DB.prepare(
      `INSERT INTO leaderboard_entries
        (id, timestamp, username, category, region, mode, pace, score,
         correct_count, total, mistakes, best_streak, elapsed_ms, scoring_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        entry.id,
        entry.timestamp,
        entry.username,
        entry.category,
        entry.region,
        entry.mode,
        entry.pace,
        entry.score,
        entry.correctCount,
        entry.total,
        entry.mistakes,
        entry.bestStreak,
        entry.elapsedMs,
        entry.scoringVersion,
      )
      .run()

    return json(
      { entry, entries: await fetchTop(env.DB, entry.region, null, entry.mode, DEFAULT_LIMIT) },
      201,
    )
  } catch (error) {
    return json({ error: 'Failed to save entry', details: String(error) }, 500)
  }
}
