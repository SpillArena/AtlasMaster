/**
 * Global ledertavle for AtlasMaster (Cloudflare Pages Function + D1).
 *
 * GET  /api/leaderboard?region=norway&category=fylker&mode=click&pace=blitz&limit=25
 * POST /api/leaderboard — send inn et resultat
 *
 * Poengsummen regnes ut i nettleseren, så den kan ikke stoles blindt på.
 * Derfor avvises alt som ikke kan ha skjedd i et ekte spill: ukjente
 * kategorier/moduser, moduser kategorien ikke tilbyr, umulige tellinger og
 * poeng over det teoretiske taket.
 *
 * HVEM som sendte inn, er ikke lenger noe innsenderen forteller oss.
 * Brukernavnet leses ut av et signert tegn og ikke ut av kroppen: en streng i
 * et JSON-felt kan være hvem som helst, og siden tavla holder én rad per
 * brukernavn, ville en høyere falsk poengsum ERSTATTE raden til den virkelige
 * spilleren i stedet for å legge seg ved siden av. Se functions/api/auth/.
 */

import { verifyToken } from '../auth/index.js'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

/**
 * Må speile regionregisteret i src/game/regions.ts. Kategori-id-ene er
 * bevisst ulike per region — «fylker» finnes bare i Norge, «countries» bare
 * i Europa — så et resultat kan ikke sendes inn under feil region.
 */
const MODES = new Set(['click', 'choice', 'type', 'flag', 'pick'])
const PACES = new Set(['relaxed', 'normal', 'blitz'])

/** Standardmodusene — må speile MODES i src/game/types.ts. */
const MAP_MODES = ['click', 'choice', 'type']
/** Flaggmodusene — kategorier som setter `modes` eksplisitt i regions.ts. */
const FLAG_MODES = ['flag', 'pick']

/**
 * Kategori → modusene kategorien faktisk tilbyr.
 *
 * Det holdt ikke å sjekke at regionen har kategorien og at modusen finnes.
 * `{world, worldFlags, type}` bestod begge testene, og landet på tavla — men
 * `worldFlags` kan bare spilles i flaggmodus, så raden kunne aldri filtreres
 * fram igjen. Den ble liggende, usynlig for alle unntatt «alle moduser».
 * Paringen region⊃kategori håndheves nettopp for at slikt ikke skal skje;
 * paringen kategori⊃modus manglet.
 */
const REGION_CATEGORIES = {
  norway: { fylker: MAP_MODES, storbyer: MAP_MODES, elver: MAP_MODES, fjell: MAP_MODES },
  europe: { countries: MAP_MODES, capitals: MAP_MODES, rivers: MAP_MODES, peaks: MAP_MODES },
  asia: {
    asiaCountries: MAP_MODES,
    asiaCapitals: MAP_MODES,
    asiaRivers: MAP_MODES,
    asiaPeaks: MAP_MODES,
  },
  usa: { usStates: MAP_MODES, usCities: MAP_MODES, usRivers: MAP_MODES, usPeaks: MAP_MODES },
  africa: {
    africaCountries: MAP_MODES,
    africaCapitals: MAP_MODES,
    africaRivers: MAP_MODES,
    africaPeaks: MAP_MODES,
    // som worldFlags: kategorien setter `modes` i regions.ts og kan bare
    // spilles i flaggmodus — se notatet over
    africaFlags: FLAG_MODES,
  },
  world: { worldCountries: MAP_MODES, worldFlags: FLAG_MODES },
}

const hasRegion = (region) => Object.hasOwn(REGION_CATEGORIES, region)
const hasCategory = (region, category) =>
  hasRegion(region) && Object.hasOwn(REGION_CATEGORIES[region], category)

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
const MODE_MULTIPLIER = { choice: 0.8, click: 1, type: 1.5, flag: 0.8, pick: 0.8 }
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
 * Én oppføring per spiller per øvelse — den beste — sortert høyest først.
 *
 * ØVELSEN er region + kategori + modus + TEMPO. Tempoet var det som manglet.
 * Det ganger poengsummen med 0,8 i rolig og 1,4 i lyn (`PACE_META` i
 * src/game/types.ts), men var verken filter eller grupperingsnøkkel: en
 * lynrunde ble rangert rett mot en rolig runde i samme celle og vant på
 * multiplikatoren alene. Toppen av enhver tavle var lynrunder, og en spiller
 * som ville måle seg mot dem hadde ingen måte å se hvorfor. Nøyaktig samme
 * grunn som `mode` ble et filter i sin tid; tempoet ble stående halvferdig.
 *
 * DEDUPLISERINGEN sier nå hva den mener. Den stod som `HAVING score =
 * MAX(score)` — en tautologi, sann for hver eneste gruppe, som ikke gjorde
 * annet enn å utløse SQLites egen regel om at bare-kolonner i en gruppe med
 * `MAX()` hentes fra maksimumsraden. Den virket, men intensjonen «behold
 * spillerens beste rad» stod ingen steder, og enhver endring som la til et
 * aggregat til eller fjernet `HAVING` ville stille og rolig gitt vilkårlige
 * rader i stedet. `ROW_NUMBER()` sier det høyt.
 */
export async function fetchTop(db, { region, category, mode, pace, limit }) {
  const filters = []
  const binds = []
  for (const [column, value] of [
    ['region', region],
    ['category', category],
    ['mode', mode],
    ['pace', pace],
  ]) {
    if (value) {
      filters.push(`${column} = ?`)
      binds.push(value)
    }
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  binds.push(limit)

  const { results } = await db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM (
         SELECT *,
                ROW_NUMBER() OVER (
                  PARTITION BY username, region, category, mode, pace
                  ORDER BY score DESC, timestamp DESC, id DESC
                ) AS rank_in_group
         FROM leaderboard_entries
         ${where}
       )
       WHERE rank_in_group = 1
       ORDER BY score DESC, timestamp DESC, id DESC
       LIMIT ?`,
    )
    .bind(...binds)
    .all()

  return results ?? []
}

/**
 * Hvilken plass en poengsum har i sin egen øvelse.
 *
 * Tavla viser tjuefem rader. En spiller som havner på plass sekstitre har
 * ingen måte å se det på — resultatskjermen sa bare at runden var lagret.
 * Innsendingen kjørte allerede et fullt tavleoppslag til for å returnere en
 * oppdatert liste som klienten kastet; dette er billigere og svarer på det
 * spilleren faktisk lurer på.
 */
export async function rankOf(db, { region, category, mode, pace, score }) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) + 1 AS rank
       FROM (
         SELECT MAX(score) AS best
         FROM leaderboard_entries
         WHERE region = ? AND category = ? AND mode = ? AND pace = ?
         GROUP BY username
       )
       WHERE best > ?`,
    )
    .bind(region, category, mode, pace, score)
    .first()
  return row?.rank ?? null
}

export function parseEntry(raw, username) {
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
  if (!hasRegion(region)) return { error: 'Invalid region' }
  if (!hasCategory(region, category)) return { error: 'Invalid category' }
  if (!MODES.has(mode)) return { error: 'Invalid mode' }
  // modusen må være en kategorien faktisk tilbyr — se REGION_CATEGORIES
  if (!REGION_CATEGORIES[region][category].includes(mode)) {
    return { error: 'Mode not available for this category' }
  }
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

/**
 * Grensa for hvor mange rader ett oppslag kan hente.
 *
 * Den stod som `Math.min(Number(param) || 25, 100)`. `?limit=-1` ga
 * `Math.min(-1, 100)`, altså −1, og SQLite tolker en negativ LIMIT som ingen
 * grense i det hele tatt: taket var en anbefaling, og hvem som helst kunne be
 * om hele tabellen. `?limit=10.5` gikk rett gjennom som brøk, og `?limit=0`
 * ble stille til 25 fordi null er falsy.
 */
export function parseLimit(raw) {
  const n = Number(raw)
  if (raw === null || !Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT)
}

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)

  /*
   * Ukjente filterverdier avvises i stedet for å forkastes stille.
   *
   * `?region=bogus&category=fylker` ga før hele den regionsløse tavla med
   * status 200: begge parametrene ble droppet, og svaret var en fullt
   * troverdig, helt feil liste. En skrivefeil skal si fra.
   *
   * Region kan fortsatt utelates — det er tavla på tvers av alle regioner, og
   * den er en gyldig forespørsel.
   */
  const region = url.searchParams.get('region')
  if (region !== null && !hasRegion(region)) return json({ error: 'Invalid region' }, 400)

  const category = url.searchParams.get('category')
  // en kategori gir bare mening innenfor en region
  if (category !== null && !hasCategory(region, category)) {
    return json({ error: 'Invalid category' }, 400)
  }

  const mode = url.searchParams.get('mode')
  if (mode !== null && !MODES.has(mode)) return json({ error: 'Invalid mode' }, 400)

  const pace = url.searchParams.get('pace')
  if (pace !== null && !PACES.has(pace)) return json({ error: 'Invalid pace' }, 400)

  try {
    const entries = await fetchTop(env.DB, {
      region,
      category,
      mode,
      pace,
      limit: parseLimit(url.searchParams.get('limit')),
    })
    return json({ entries })
  } catch (error) {
    return json({ error: 'Failed to load leaderboard', details: String(error) }, 500)
  }
}

export async function onRequestPost(context) {
  const { env, request } = context

  if (!env.AUTH_SECRET) {
    return json({ error: 'Accounts are not configured on this deployment' }, 503)
  }

  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const username = await verifyToken(env.AUTH_SECRET, token)
  if (!username) return json({ error: 'Sign in to post a score' }, 401)

  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  // navnet kommer fra tegnet, aldri fra kroppen
  const parsed = parseEntry(payload, username)
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

    // svaret bærer plasseringen, ikke en tavle klienten kaster
    return json({ entry, rank: await rankOf(env.DB, entry) }, 201)
  } catch (error) {
    return json({ error: 'Failed to save entry', details: String(error) }, 500)
  }
}
