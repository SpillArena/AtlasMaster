/**
 * Røyktest av leiartavle-skjemaet mot ekte SQLite.
 *
 *   node --experimental-sqlite scripts/check-leaderboard-sql.mjs
 *
 * D1 er SQLite, så migrasjonane og spørjingane kan verifiserast lokalt utan
 * å røre produksjonsdatabasen. Testen bryr seg om éin ting spesielt: at rader
 * som fanst FØR regionane blir liggande att som norske runder etter 0002.
 */

import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const db = new DatabaseSync(':memory:')

const runSql = (file) => {
  const sql = readFileSync(resolve(here, '../migrations', file), 'utf8')
  for (const stmt of sql.split(';')) {
    if (stmt.trim()) db.exec(stmt)
  }
}

let failures = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`        venta ${JSON.stringify(expected)}, fekk ${JSON.stringify(actual)}`)
}

// --- 0001: skjemaet slik det såg ut før regionane ---
runSql('0001_create_leaderboard.sql')

const legacy = db.prepare(`
  INSERT INTO leaderboard_entries
    (id, timestamp, username, category, mode, pace, score,
     correct_count, total, mistakes, best_streak, elapsed_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
legacy.run('old-1', '2026-01-01T00:00:00Z', 'Kari', 'fylker', 'click', 'normal', 900, 15, 15, 0, 15, 60000)
legacy.run('old-2', '2026-01-02T00:00:00Z', 'Ola', 'fjell', 'type', 'blitz', 400, 8, 10, 2, 5, 30000)

// --- 0002: legg til region ---
runSql('0002_add_region.sql')

check(
  'gamle rader blir backfilla som norway',
  db.prepare('SELECT region, COUNT(*) AS n FROM leaderboard_entries GROUP BY region').all(),
  [{ region: 'norway', n: 2 }],
)

// --- nye rader med region ---
db.prepare(`
  INSERT INTO leaderboard_entries
    (id, timestamp, username, category, region, mode, pace, score,
     correct_count, total, mistakes, best_streak, elapsed_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'new-1', '2026-02-01T00:00:00Z', 'Kari', 'countries', 'europe', 'click', 'normal', 5000, 39, 39, 0, 39, 120000,
)

const SELECT_COLUMNS = `
    id, timestamp, username, category, region, mode, pace, score,
    correct_count AS correctCount, total, mistakes,
    best_streak AS bestStreak, elapsed_ms AS elapsedMs`

/** Same spørjing som Pages-funksjonen byggjer. */
function fetchTop(region, category, limit) {
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
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  binds.push(limit)
  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM leaderboard_entries
       ${where}
       GROUP BY username, region, category, mode
       HAVING score = MAX(score)
       ORDER BY score DESC, timestamp DESC, id DESC
       LIMIT ?`,
    )
    .all(...binds)
}

check(
  'Noreg-tavla viser berre norske runder',
  fetchTop('norway', null, 25).map((r) => r.category).sort(),
  ['fjell', 'fylker'],
)

check(
  'Europa-tavla viser berre europeiske runder',
  fetchTop('europe', null, 25).map((r) => r.category),
  ['countries'],
)

check(
  'region + kategori filtrerer til éi rad',
  fetchTop('norway', 'fylker', 25).map((r) => r.id),
  ['old-1'],
)

check(
  'same spelar kan toppe begge regionar utan kollisjon',
  fetchTop(null, null, 25).filter((r) => r.username === 'Kari').map((r) => r.region).sort(),
  ['europe', 'norway'],
)

// beste resultat per spelar+region+kategori+modus
db.prepare(`
  INSERT INTO leaderboard_entries
    (id, timestamp, username, category, region, mode, pace, score,
     correct_count, total, mistakes, best_streak, elapsed_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'new-2', '2026-02-02T00:00:00Z', 'Kari', 'countries', 'europe', 'click', 'normal', 1000, 20, 39, 5, 10, 120000,
)

check(
  'berre spelaren sitt beste resultat blir vist',
  fetchTop('europe', 'countries', 25).map((r) => r.score),
  [5000],
)

console.log(failures === 0 ? '\nAlle sjekkar gjekk gjennom.' : `\n${failures} sjekk(ar) feila.`)
process.exit(failures === 0 ? 0 : 1)
