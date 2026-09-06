/**
 * Vaktpost for polygondatasettene.
 *
 *   npm run check:geo
 *
 * Sjekker to ting som begge gjør et kart ubrukelig uten å gi feilmelding
 * noe sted:
 *
 * 1. INVERTERTE RINGER. d3-geo leser et polygon sfærisk — hvilken side av ringen
 *    som er «inne» følger av hvilken vei den går. Går ytterringen feil vei, blir
 *    landet tegnet som *resten av kloden*, og kartet blir et ensfarget
 *    rektangel. Testen er arealet: et land som dekker mer enn en tidel av
 *    jorda er ikke et land.
 *
 * 2. UTSNITT SOM SPRENGER SEG. En geometri som strekker seg langt utenfor
 *    regionen — typisk fordi den krysser datolinja, eller fordi en rett kant
 *    langs en breddegrad blir tegnet som en storsirkel og buler — drar
 *    `fitExtent` med seg, og alle de andre landene krymper. Testen sammenligner
 *    utsnittet med det regionen skal ha.
 *
 * 3. DOBLE ID-ER. To features med samme id blir to like svar i quizen, og et
 *    treff på det ene lar det andre stå igjen som uløst. world-atlas 50m fører
 *    Australia som to flater med samme kode; byggeren slår dem sammen, og denne
 *    testen er det som sier fra om en ny kilde gjør det samme igjen.
 *
 * 4. TOMME SVAR. En flate som forenklinga har etet opp er et svar ingen kan
 *    klikke på — spilleren står igjen med et spørsmål uten fasit på kartet.
 *
 * 5. FLAGG SOM IKKE HENGER SAMMEN. Verdensregionen har flaggmoduser; et spillbart
 *    land uten flaggfil, eller en flaggfil uten land, er en runde som bryter.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoBounds } from 'd3-geo'
import { flagCoverage } from '../src/game/flags.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** Kvadratkilometer på hele kloden — brukt til å gjøre steradian lesbart. */
const EARTH_KM2 = 5.1006e8

/** Ingen enkeltland dekker mer enn dette. Over = inverterte ringer. */
const MAX_FEATURE_KM2 = 3e7

/**
 * Utsnittet hver region skal holde seg innenfor, i lengde/bredde. Litt luft er
 * lagt inn; poenget er å fange geometri som har rømt, ikke å måle presist.
 */
const CASES = [
  {
    region: 'Norge',
    file: 'src/data/norway/counties.json',
    box: { minLon: 4, maxLon: 32, minLat: 57, maxLat: 72 },
  },
  {
    region: 'Europa',
    file: 'src/data/europe/countries.json',
    box: { minLon: -26, maxLon: 47, minLat: 33, maxLat: 72 },
  },
  {
    region: 'Asia',
    file: 'src/data/asia/countries.json',
    box: { minLon: 25, maxLon: 151, minLat: -12, maxLat: 59 },
  },
  {
    region: 'USA',
    file: 'src/data/usa/states.json',
    box: { minLon: -180, maxLon: -66, minLat: 18, maxLat: 72 },
    // Aleutene strekker seg forbi 180°, så `geoBounds` gir et utsnitt som går
    // andre veien rundt kloden. Det er rett her, og albersUsa flytter uansett
    // Alaska inn i sin egen rute.
    wrapsDateline: true,
  },
  {
    region: 'Verden',
    file: 'src/data/world/countries.json',
    box: { minLon: -180, maxLon: 180, minLat: -60, maxLat: 84 },
  },
]

let failed = false

const isPlayable = (f) => f.properties?.playable !== false

/** Diagonalen i omslutningsboksen, i grader. Null = ingenting igjen å tegne. */
function extent(geometry) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      minX = Math.min(minX, c[0])
      minY = Math.min(minY, c[1])
      maxX = Math.max(maxX, c[0])
      maxY = Math.max(maxY, c[1])
      return
    }
    c.forEach(walk)
  }
  walk(geometry?.coordinates ?? [])
  return Number.isFinite(minX) ? Math.hypot(maxX - minX, maxY - minY) : 0
}

/**
 * Hvor liten en feature kan være, i del av regionens eget utsnitt, før den er
 * avhengig av den usynlige treffflata i components/game/MapCanvas.tsx.
 *
 * Kartet er 900 enheter høyt og treffmålet 22 CSS-piksler; på en telefon
 * svarer det til rundt åtti enheter, altså under en tidel av kartet. Tallet
 * er ikke en grense som feiler — det er bare verdt å se hvem som er
 * avhengig av hjelpa, så ingen tror Malta er klikkbar av seg selv.
 */
const ASSIST_RATIO = 0.09

for (const c of CASES) {
  const fc = JSON.parse(readFileSync(resolve(root, c.file), 'utf8'))
  const [[lon0, lat0], [lon1, lat1]] = geoBounds(fc)

  const seen = new Map()
  const duplicates = []
  const empty = []
  for (const f of fc.features) {
    const id = String(f.properties?.id)
    if (seen.has(id)) duplicates.push(`${seen.get(id)} / ${f.properties?.name} (${id})`)
    seen.set(id, f.properties?.name)
    if (isPlayable(f) && extent(f.geometry) === 0) empty.push(f.properties?.name ?? id)
  }

  const oversized = fc.features
    .map((f) => ({ name: f.properties?.name, km2: (geoArea(f) / (4 * Math.PI)) * EARTH_KM2 }))
    .filter((f) => f.km2 > MAX_FEATURE_KM2)

  const lonEscaped = c.wrapsDateline ? false : lon0 < c.box.minLon || lon1 > c.box.maxLon
  const escaped = lonEscaped || lat0 < c.box.minLat || lat1 > c.box.maxLat
  const broken = oversized.length || escaped || duplicates.length || empty.length

  const fmt = (v) => v.toFixed(1)
  console.log(
    `${c.region.padEnd(8)} ${String(fc.features.length).padStart(3)} features   ` +
      `${fmt(lon0)}…${fmt(lon1)}°  ${fmt(lat0)}…${fmt(lat1)}°   ` +
      (broken ? 'FEIL' : 'ok'),
  )
  for (const f of oversized) {
    console.error(`  ! «${f.name}» dekker ${Math.round(f.km2)} km² — ringen går trolig feil vei`)
    failed = true
  }
  if (escaped) {
    console.error(`  ! utsnittet er utenfor det regionen skal ha`)
    failed = true
  }
  for (const d of duplicates) {
    console.error(`  ! to features deler id: ${d}`)
    failed = true
  }
  for (const name of empty) {
    console.error(`  ! «${name}» er spillbar, men har ingen geometri igjen å klikke på`)
    failed = true
  }

  // et utsnitt som går andre veien rundt kloden gir ingen meningsfull
  // målestokk å sammenligne med, så rapporten står over de tilfellene
  const span = c.wrapsDateline ? 0 : Math.hypot(lon1 - lon0, lat1 - lat0)
  const assisted = fc.features
    .filter((f) => isPlayable(f) && extent(f.geometry) < span * ASSIST_RATIO)
    .map((f) => f.properties?.name)
  if (assisted.length) {
    console.log(`  små:    ${assisted.length} trenger treffflata (${assisted.slice(0, 6).join(', ')}${assisted.length > 6 ? ', …' : ''})`)
  }
}

/*
 * Verdensregionen: omrisset og spillkartet må være samme kart.
 *
 * Landingssida tegner outline.json og spillet countries.json. Driver dem fra
 * hverandre, klikker spilleren på et land som ikke finnes i runden etterpå.
 */
const worldPlay = JSON.parse(readFileSync(resolve(root, 'src/data/world/countries.json'), 'utf8'))
const worldOutline = JSON.parse(readFileSync(resolve(root, 'src/data/world/outline.json'), 'utf8'))
const playIds = new Set(worldPlay.features.map((f) => String(f.properties.id)))
const outlineIds = new Set(worldOutline.features.map((f) => String(f.properties.id)))
const onlyPlay = [...playIds].filter((id) => !outlineIds.has(id))
const onlyOutline = [...outlineIds].filter((id) => !playIds.has(id))
if (onlyPlay.length || onlyOutline.length) {
  console.error(
    `  ! omrisset og spillkartet er ulike: ${onlyPlay.length} bare i spillet, ` +
      `${onlyOutline.length} bare i omrisset`,
  )
  failed = true
}

/*
 * Flaggsettet i verdensregionen. Her er dekningen ikke et tillegg: `worldFlags`
 * *er* flaggmodusene, så et spillbart land uten flagg er en runde som ikke
 * kan svares.
 */
const flagDir = resolve(root, 'src/data/world/flags')
const flagMap = JSON.parse(readFileSync(resolve(root, 'src/data/world/flags.json'), 'utf8'))
const noFlag = worldPlay.features
  .filter((f) => isPlayable(f))
  .filter((f) => !flagMap[f.properties.id] || !existsSync(resolve(flagDir, `${flagMap[f.properties.id]}.svg`)))
  .map((f) => f.properties.name)
const onDisk = new Set(readdirSync(flagDir))
const orphan = Object.entries(flagMap)
  .filter(([id, iso2]) => !playIds.has(id) || !onDisk.has(`${iso2}.svg`))
  .map(([id]) => id)
const unused = [...onDisk].filter((file) => !Object.values(flagMap).includes(file.replace('.svg', '')))
for (const name of noFlag) {
  console.error(`  ! «${name}» er spillbar i flaggmodus, men har ikke flagg`)
  failed = true
}
for (const id of orphan) {
  console.error(`  ! flagg-oppslaget «${id}» peker på et land eller en fil som ikke finnes`)
  failed = true
}
for (const file of unused) {
  console.error(`  ! flaggfila ${file} hører ikke til noe land`)
  failed = true
}

/*
 * Flaggdekningen i Europa.
 *
 * Ikke en feil — flagget er med vilje et tillegg, og landene vi ikke kan
 * tegne troverdig står uten. Men tallet skal være synlig, så ingen tror
 * dekningen er full, og så det er lett å se hva som er igjen.
 */
console.log('')
for (const [set, file, what] of [
  ['europe', 'src/data/europe/countries.json', 'land'],
  ['usStates', 'src/data/usa/states.json', 'delstater'],
]) {
  const fc = JSON.parse(readFileSync(resolve(root, file), 'utf8'))
  const byId = new Map(fc.features.map((f) => [String(f.properties.id), f.properties.name]))
  const { drawn, missing } = flagCoverage(set, [...byId.keys()])
  console.log(`merke     ${drawn.length}/${byId.size} ${what} tegnet`)
  if (missing.length) {
    console.log(`  uten:   ${missing.map((id) => byId.get(id)).join(', ')}`)
  }
}

if (failed) process.exitCode = 1
