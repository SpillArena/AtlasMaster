/**
 * Røyktest av leiartavle-skjemaet mot ekte SQLite.
 *
 *   node --experimental-sqlite scripts/check-leaderboard-sql.mjs
 *
 * D1 er SQLite, så migrasjonane og spørjingane kan verifiserast lokalt utan
 * å røre produksjonsdatabasen. Testen bryr seg om to ting spesielt: at rader
 * som fanst FØR regionane blir liggande att som norske runder etter 0002, og
 * at rader som fanst før modusane fekk kvar sin verdi blir merkte som
 * poengversjon 1 etter 0003 — ikkje sletta, ikkje omrekna, berre merkte.
 */

import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  fetchTop as realFetchTop,
  parseEntry,
  parseLimit,
  rankOf as realRankOf,
} from '../functions/api/leaderboard/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const db = new DatabaseSync(':memory:')

/**
 * Køyrer ein migrasjonsfil, éi setning om gongen.
 *
 * Linjekommentarane blir strokne først. Splittinga er naiv — han deler på
 * semikolon — og eit semikolon inne i ein kommentar delte difor kommentaren i
 * to, og andre halvdelen blei prøvd køyrd som SQL. Migrasjonane her er tungt
 * kommenterte, så det er ei felle som ligg og ventar på neste som skriv ein
 * heilsetning med semikolon i.
 */
const runSql = (file) => {
  const sql = readFileSync(resolve(here, '../migrations', file), 'utf8').replace(/--[^\n]*/g, '')
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

// --- 0003: legg til poengversjon ---
runSql('0003_add_scoring_version.sql')

// --- 0004: indeksane spørjinga faktisk treng, og ein daud indeks ut ---
runSql('0004_leaderboard_pace_index.sql')

check(
  'rader frå før modusverdiane blir merkte som versjon 1',
  db.prepare('SELECT scoring_version AS v, COUNT(*) AS n FROM leaderboard_entries GROUP BY v').all(),
  [{ v: 1, n: 3 }],
)

const SELECT_COLUMNS = `
    id, timestamp, username, category, region, mode, pace, score,
    correct_count AS correctCount, total, mistakes,
    best_streak AS bestStreak, elapsed_ms AS elapsedMs,
    scoring_version AS scoringVersion`

/**
 * D1-fasade over node:sqlite.
 *
 * Spørjinga stod skriven av på nytt her før — ein kopi av den i
 * Pages-funksjonen, som testa at kopien var seg sjølv lik. Ho fanga ikkje at
 * tempoet mangla frå grupperinga, for kopien mangla det same.
 *
 * D1 og node:sqlite har ulik form på API-et: D1 kjeder `.bind()` og gjev
 * `{ results }`, node:sqlite tek bindingane rett i `.all()`. Denne vesle
 * fasaden er alt som skal til for at testen køyrer den *ekte* koden.
 */
const d1 = {
  prepare(sql) {
    const stmt = db.prepare(sql)
    return {
      bind(...binds) {
        return {
          all: async () => ({ results: stmt.all(...binds) }),
          first: async () => stmt.get(...binds) ?? null,
        }
      },
    }
  },
}

const fetchTop = (region, category, mode, limit, pace = null) =>
  realFetchTop(d1, { region, category, mode, pace, limit })

check(
  'Noreg-tavla viser berre norske runder',
  (await fetchTop('norway', null, null, 25)).map((r) => r.category).sort(),
  ['fjell', 'fylker'],
)

check(
  'Europa-tavla viser berre europeiske runder',
  (await fetchTop('europe', null, null, 25)).map((r) => r.category),
  ['countries'],
)

check(
  'region + kategori filtrerer til éi rad',
  (await fetchTop('norway', 'fylker', null, 25)).map((r) => r.id),
  ['old-1'],
)

check(
  'same spelar kan toppe begge regionar utan kollisjon',
  (await fetchTop(null, null, null, 25)).filter((r) => r.username === 'Kari').map((r) => r.region).sort(),
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
  (await fetchTop('europe', 'countries', null, 25)).map((r) => r.score),
  [5000],
)

/*
 * Ei skriverunde i same kategori. Poenga er rekna etter dei nye reglane, der
 * skrivemodus er verdt halvannan gong ei klikkerunde, så ho legg seg over
 * klikkeresultatet på ei blanda tavle. Filteret er det som gjer at dei to
 * ikkje blir rangerte mot kvarandre.
 */
db.prepare(`
  INSERT INTO leaderboard_entries
    (id, timestamp, username, category, region, mode, pace, score,
     correct_count, total, mistakes, best_streak, elapsed_ms, scoring_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'new-3', '2026-03-01T00:00:00Z', 'Ola', 'countries', 'europe', 'type', 'normal', 7500, 39, 39, 0, 39, 200000, 2,
)

check(
  'modusfilteret held skriverunder utanfor klikketavla',
  (await fetchTop('europe', 'countries', 'click', 25)).map((r) => r.id),
  ['new-1'],
)

check(
  'skriverunda har si eiga tavle',
  (await fetchTop('europe', 'countries', 'type', 25)).map((r) => r.id),
  ['new-3'],
)

check(
  'nye rader ber den nye poengversjonen',
  (await fetchTop('europe', 'countries', 'type', 25)).map((r) => r.scoringVersion),
  [2],
)

/*
 * Tempoet som eiga øving.
 *
 * Same spelar, same kategori, same modus — men rolig (×0,8) og lyn (×1,4).
 * Utan tempoet i grupperinga blei lynrunda ståande åleine i cella, og den
 * rolige runda forsvann frå tavla utan at nokon hadde tapt noko.
 */
const paced = db.prepare(`
  INSERT INTO leaderboard_entries
    (id, timestamp, username, category, region, mode, pace, score,
     correct_count, total, mistakes, best_streak, elapsed_ms, scoring_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
paced.run('pace-calm', '2026-03-01T00:00:00Z', 'Siri', 'capitals', 'europe', 'click', 'relaxed', 500, 30, 39, 2, 12, 90000, 2)
paced.run('pace-fast', '2026-03-02T00:00:00Z', 'Siri', 'capitals', 'europe', 'click', 'blitz', 900, 30, 39, 2, 12, 40000, 2)

check(
  'rolig og lyn er to øvingar, ikkje éi',
  (await fetchTop('europe', 'capitals', 'click', 25)).map((r) => r.id),
  ['pace-fast', 'pace-calm'],
)

check(
  'tempofilteret hentar berre den rolige runda',
  (await fetchTop('europe', 'capitals', 'click', 25, 'relaxed')).map((r) => r.id),
  ['pace-calm'],
)

/* Framleis éin rad per spelar innanfor éi og same øving. */
paced.run('pace-fast-2', '2026-03-03T00:00:00Z', 'Siri', 'capitals', 'europe', 'click', 'blitz', 1200, 33, 39, 1, 15, 38000, 2)
check(
  'beste lynrunda vinn over den førre lynrunda',
  (await fetchTop('europe', 'capitals', 'click', 25, 'blitz')).map((r) => [r.id, r.score]),
  [['pace-fast-2', 1200]],
)

/* Sortering: høgast poengsum først, uansett kor raden kom inn. */
check(
  'tavla er sortert høgast først',
  (await fetchTop('europe', null, null, 25)).map((r) => r.score),
  [...(await fetchTop('europe', null, null, 25)).map((r) => r.score)].sort((a, b) => b - a),
)

/*
 * `?limit=-1` gav Math.min(-1, 100) = -1, og SQLite les ein negativ LIMIT som
 * ingen grense: taket var berre ei tilråding.
 */
check('limit −1 blir 1, ikkje heile tabellen', parseLimit('-1'), 1)
check('limit 0 blir 1', parseLimit('0'), 1)
check('limit 10.5 blir 10', parseLimit('10.5'), 10)
check('limit 9999 blir kappa til taket', parseLimit('9999'), 100)
check('limit utan verdi blir standarden', parseLimit(null), 25)
check('limit som ikkje er eit tal blir standarden', parseLimit('mange'), 25)
check(
  'ein negativ limit hentar ikkje meir enn éi rad',
  (await fetchTop('europe', null, null, parseLimit('-1'))).length,
  1,
)

/*
 * Modusen må vere ein kategorien faktisk tilbyr. `worldFlags` kan berre
 * spelast i flaggmodus; ei skriverunde der kunne aldri filtrerast fram igjen.
 */
const submission = (over) => ({
  username: 'Siri',
  region: 'world',
  category: 'worldFlags',
  mode: 'flag',
  pace: 'normal',
  score: 100,
  correctCount: 5,
  total: 10,
  mistakes: 1,
  bestStreak: 3,
  elapsedMs: 20000,
  ...over,
})
check('flaggmodus er lov i flaggkategorien', parseEntry(submission()).error ?? 'ok', 'ok')
check(
  'skrivemodus er ikkje lov i flaggkategorien',
  parseEntry(submission({ mode: 'type' })).error,
  'Mode not available for this category',
)
check(
  'flaggmodus er ikkje lov i ein vanleg kartkategori',
  parseEntry(submission({ region: 'norway', category: 'fylker' })).error,
  'Mode not available for this category',
)
check(
  'ukjend kategori i ein kjend region blir avvist',
  parseEntry(submission({ category: 'fylker' })).error,
  'Invalid category',
)

/* Plasseringa innsendaren får tilbake. */
check(
  'plasseringa er rekna mot spelarane sitt beste',
  await realRankOf(d1, {
    region: 'europe',
    category: 'capitals',
    mode: 'click',
    pace: 'blitz',
    score: 1200,
  }),
  1,
)
check(
  'ein dårlegare poengsum får plassen bak',
  await realRankOf(d1, {
    region: 'europe',
    category: 'capitals',
    mode: 'click',
    pace: 'blitz',
    score: 10,
  }),
  2,
)

/* Indeksane frå 0004 skal finnast, og den avløyste frå 0001 skal vere borte. */
const indexes = db
  .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name`)
  .all()
  .map((r) => r.name)
check('grupperingsindeksen finst', indexes.includes('idx_leaderboard_group_best'), true)
check(
  'filterindeksen med tempo finst',
  indexes.includes('idx_leaderboard_region_category_mode_pace'),
  true,
)
check(
  'den avløyste indeksen frå 0001 er borte',
  indexes.includes('idx_leaderboard_category_score'),
  false,
)

console.log(failures === 0 ? '\nAlle sjekkar gjekk gjennom.' : `\n${failures} sjekk(ar) feila.`)
process.exit(failures === 0 ? 0 : 1)
