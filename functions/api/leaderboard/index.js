/**
 * Global ledertavle for NorgesMester (Cloudflare Pages Function + D1).
 *
 * GET  /api/leaderboard?category=fylker&limit=25 — beste resultater
 * POST /api/leaderboard                          — send inn et resultat
 *
 * Poengsummen regnes ut i nettleseren, så den kan ikke stoles blindt på.
 * Derfor avvises alt som ikke kan ha skjedd i et ekte spill: ukjente
 * kategorier/moduser, umulige tellinger og poeng over det teoretiske taket.
 */

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

const CATEGORIES = new Set(['fylker', 'storbyer', 'elver', 'fjell'])
const MODES = new Set(['click', 'choice', 'type'])
const PACES = new Set(['relaxed', 'normal', 'blitz'])

/** Må speile PACE_META i src/game/types.ts. */
const PACE_MULTIPLIER = { relaxed: 0.8, normal: 1, blitz: 1.4 }
/** Grunnpoeng + fartsbonus, ganget med maks combo (×2). */
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
    mode,
    pace,
    score,
    correct_count AS correctCount,
    total,
    mistakes,
    best_streak AS bestStreak,
    elapsed_ms AS elapsedMs`

/** Én oppføring per spiller per kategori+modus — den beste. */
async function fetchTop(db, category, limit) {
  const where = category ? 'WHERE category = ?' : ''
  const binds = category ? [category, limit] : [limit]

  const { results } = await db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM leaderboard_entries
       ${where}
       GROUP BY username, category, mode
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
  const mode = typeof raw.mode === 'string' ? raw.mode : ''
  const pace = typeof raw.pace === 'string' ? raw.pace : ''
  const score = Number(raw.score)
  const correctCount = Number(raw.correctCount)
  const total = Number(raw.total)
  const mistakes = Number(raw.mistakes)
  const bestStreak = Number(raw.bestStreak)
  const elapsedMs = Number(raw.elapsedMs)

  if (!username || username.length > 20) return { error: 'Invalid username' }
  if (!CATEGORIES.has(category)) return { error: 'Invalid category' }
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

  const ceiling = Math.ceil(total * MAX_POINTS_PER_TARGET * PACE_MULTIPLIER[pace])
  if (!Number.isFinite(score) || score < 0 || score > ceiling) return { error: 'Invalid score' }

  return {
    entry: {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      username,
      category,
      mode,
      pace,
      score: Math.round(score),
      correctCount,
      total,
      mistakes,
      bestStreak,
      elapsedMs,
    },
  }
}

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)
  const categoryParam = url.searchParams.get('category')
  const category = categoryParam && CATEGORIES.has(categoryParam) ? categoryParam : null
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

  try {
    return json({ entries: await fetchTop(env.DB, category, limit) })
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
        (id, timestamp, username, category, mode, pace, score,
         correct_count, total, mistakes, best_streak, elapsed_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        entry.id,
        entry.timestamp,
        entry.username,
        entry.category,
        entry.mode,
        entry.pace,
        entry.score,
        entry.correctCount,
        entry.total,
        entry.mistakes,
        entry.bestStreak,
        entry.elapsedMs,
      )
      .run()

    return json({ entry, entries: await fetchTop(env.DB, null, DEFAULT_LIMIT) }, 201)
  } catch (error) {
    return json({ error: 'Failed to save entry', details: String(error) }, 500)
  }
}
