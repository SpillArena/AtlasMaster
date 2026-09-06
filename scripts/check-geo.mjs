/**
 * Vaktpost for polygondatasetta.
 *
 *   npm run check:geo
 *
 * Sjekkar to ting som begge gjer eit kart ubrukeleg utan å gje feilmelding
 * nokon stad:
 *
 * 1. INVERTERTE RINGAR. d3-geo les eit polygon sfærisk — kva side av ringen
 *    som er «inne» følgjer av kva veg han går. Går ytterringen feil veg, blir
 *    landet teikna som *resten av kloden*, og kartet blir eit einsfarga
 *    rektangel. Testen er arealet: eit land som dekkjer meir enn ein tidel av
 *    jorda er ikkje eit land.
 *
 * 2. UTSNITT SOM SPRENG SEG. Ei geometri som strekk seg langt utanfor
 *    regionen — typisk fordi ho kryssar datolinja, eller fordi ein rett kant
 *    langs ein breiddegrad blir teikna som ein storsirkel og bular — dreg
 *    `fitExtent` med seg, og alle dei andre landa krympar. Testen samanliknar
 *    utsnittet med det regionen skal ha.
 *
 * 3. DOBLE ID-AR. To features med same id blir to like svar i quizen, og eit
 *    treff på det eine lèt det andre stå att som uløyst. world-atlas 50m fører
 *    Australia som to flater med same kode; byggjaren slår dei saman, og denne
 *    testen er det som seier frå om ei ny kjelde gjer det same igjen.
 *
 * 4. TOMME SVAR. Ei flate som forenklinga har ete opp er eit svar ingen kan
 *    klikke på — spelaren står att med eit spørsmål utan fasit på kartet.
 *
 * 5. FLAGG SOM IKKJE HENG SAMAN. Verdsregionen har flaggmodusar; eit spelbart
 *    land utan flaggfil, eller ei flaggfil utan land, er ein runde som bryt.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoBounds } from 'd3-geo'
import { flagCoverage } from '../src/game/flags.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** Kvadratkilometer på heile kloden — brukt til å gjere steradian lesbart. */
const EARTH_KM2 = 5.1006e8

/** Ingen enkeltland dekkjer meir enn dette. Over = inverterte ringar. */
const MAX_FEATURE_KM2 = 3e7

/**
 * Utsnittet kvar region skal halde seg innanfor, i lengd/breidd. Litt luft er
 * lagt inn; poenget er å fange geometri som har rømt, ikkje å måle presist.
 */
const CASES = [
  {
    region: 'Noreg',
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
    // Aleutene strekk seg forbi 180°, så `geoBounds` gjev eit utsnitt som går
    // andre vegen rundt kloden. Det er rett her, og albersUsa flyttar uansett
    // Alaska inn i si eiga rute.
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

/** Diagonalen i omslutningsboksen, i grader. Null = ingenting att å teikne. */
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
 * Kor liten ein feature kan vere, i del av regionens eige utsnitt, før han er
 * avhengig av den usynlege treffflata i components/game/MapCanvas.tsx.
 *
 * Kartet er 900 einingar høgt og treffmålet 22 CSS-pikslar; på ein telefon
 * svarar det til rundt åtti einingar, altså under ein tidel av kartet. Talet
 * er ikkje ei grense som feilar — det er berre verdt å sjå kven som er
 * avhengig av hjelpa, så ingen trur Malta er klikkbar av seg sjølv.
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
    console.error(`  ! «${f.name}» dekkjer ${Math.round(f.km2)} km² — ringen går truleg feil veg`)
    failed = true
  }
  if (escaped) {
    console.error(`  ! utsnittet er utanfor det regionen skal ha`)
    failed = true
  }
  for (const d of duplicates) {
    console.error(`  ! to features deler id: ${d}`)
    failed = true
  }
  for (const name of empty) {
    console.error(`  ! «${name}» er spelbar, men har inga geometri att å klikke på`)
    failed = true
  }

  // eit utsnitt som går andre vegen rundt kloden gjev inga meiningsfull
  // målestokk å samanlikne med, så rapporten står over dei tilfella
  const span = c.wrapsDateline ? 0 : Math.hypot(lon1 - lon0, lat1 - lat0)
  const assisted = fc.features
    .filter((f) => isPlayable(f) && extent(f.geometry) < span * ASSIST_RATIO)
    .map((f) => f.properties?.name)
  if (assisted.length) {
    console.log(`  små:    ${assisted.length} treng treffflata (${assisted.slice(0, 6).join(', ')}${assisted.length > 6 ? ', …' : ''})`)
  }
}

/*
 * Verdsregionen: omrisset og spelkartet må vere same kart.
 *
 * Landingssida teiknar outline.json og spelet countries.json. Driv dei frå
 * kvarandre, klikkar spelaren på eit land som ikkje finst i runden etterpå.
 */
const worldPlay = JSON.parse(readFileSync(resolve(root, 'src/data/world/countries.json'), 'utf8'))
const worldOutline = JSON.parse(readFileSync(resolve(root, 'src/data/world/outline.json'), 'utf8'))
const playIds = new Set(worldPlay.features.map((f) => String(f.properties.id)))
const outlineIds = new Set(worldOutline.features.map((f) => String(f.properties.id)))
const onlyPlay = [...playIds].filter((id) => !outlineIds.has(id))
const onlyOutline = [...outlineIds].filter((id) => !playIds.has(id))
if (onlyPlay.length || onlyOutline.length) {
  console.error(
    `  ! omrisset og spelkartet er ulike: ${onlyPlay.length} berre i spelet, ` +
      `${onlyOutline.length} berre i omrisset`,
  )
  failed = true
}

/*
 * Flaggsettet i verdsregionen. Her er dekninga ikkje eit tillegg: `worldFlags`
 * *er* flaggmodusane, så eit spelbart land utan flagg er ein runde som ikkje
 * kan svarast.
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
  console.error(`  ! «${name}» er spelbar i flaggmodus, men har ikkje flagg`)
  failed = true
}
for (const id of orphan) {
  console.error(`  ! flagg-oppslaget «${id}» peikar på eit land eller ei fil som ikkje finst`)
  failed = true
}
for (const file of unused) {
  console.error(`  ! flaggfila ${file} høyrer ikkje til noko land`)
  failed = true
}

/*
 * Flaggdekninga i Europa.
 *
 * Ikkje ein feil — flagget er med vilje eit tillegg, og landa vi ikkje kan
 * teikne truverdig står utan. Men talet skal vere synleg, så ingen trur
 * dekninga er full, og så det er lett å sjå kva som er att.
 */
console.log('')
for (const [set, file, what] of [
  ['europe', 'src/data/europe/countries.json', 'land'],
  ['usStates', 'src/data/usa/states.json', 'delstatar'],
]) {
  const fc = JSON.parse(readFileSync(resolve(root, file), 'utf8'))
  const byId = new Map(fc.features.map((f) => [String(f.properties.id), f.properties.name]))
  const { drawn, missing } = flagCoverage(set, [...byId.keys()])
  console.log(`merke     ${drawn.length}/${byId.size} ${what} teikna`)
  if (missing.length) {
    console.log(`  utan:   ${missing.map((id) => byId.get(id)).join(', ')}`)
  }
}

if (failed) process.exitCode = 1
