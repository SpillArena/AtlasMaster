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
 */

import { readFileSync } from 'node:fs'
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
]

let failed = false

for (const c of CASES) {
  const fc = JSON.parse(readFileSync(resolve(root, c.file), 'utf8'))
  const [[lon0, lat0], [lon1, lat1]] = geoBounds(fc)

  const oversized = fc.features
    .map((f) => ({ name: f.properties?.name, km2: (geoArea(f) / (4 * Math.PI)) * EARTH_KM2 }))
    .filter((f) => f.km2 > MAX_FEATURE_KM2)

  const lonEscaped = c.wrapsDateline ? false : lon0 < c.box.minLon || lon1 > c.box.maxLon
  const escaped = lonEscaped || lat0 < c.box.minLat || lat1 > c.box.maxLat

  const fmt = (v) => v.toFixed(1)
  console.log(
    `${c.region.padEnd(8)} ${String(fc.features.length).padStart(3)} features   ` +
      `${fmt(lon0)}…${fmt(lon1)}°  ${fmt(lat0)}…${fmt(lat1)}°   ` +
      (oversized.length || escaped ? 'FEIL' : 'ok'),
  )
  for (const f of oversized) {
    console.error(`  ! «${f.name}» dekkjer ${Math.round(f.km2)} km² — ringen går truleg feil veg`)
    failed = true
  }
  if (escaped) {
    console.error(`  ! utsnittet er utanfor det regionen skal ha`)
    failed = true
  }
}

/*
 * Flaggdekninga i Europa.
 *
 * Ikkje ein feil — flagget er med vilje eit tillegg, og landa vi ikkje kan
 * teikne truverdig står utan. Men talet skal vere synleg, så ingen trur
 * dekninga er full, og så det er lett å sjå kva som er att.
 */
{
  const fc = JSON.parse(readFileSync(resolve(root, 'src/data/europe/countries.json'), 'utf8'))
  const byId = new Map(fc.features.map((f) => [String(f.properties.id), f.properties.name]))
  const { drawn, missing } = flagCoverage([...byId.keys()])
  console.log(
    `\nflagg     ${drawn.length}/${byId.size} land teikna` +
      (missing.length ? `\n  utan:   ${missing.map((id) => byId.get(id)).join(', ')}` : ''),
  )
}

if (failed) process.exitCode = 1
