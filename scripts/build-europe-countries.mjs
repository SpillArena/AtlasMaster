/**
 * Genererer src/data/europe/countries.json fra Natural Earth (via world-atlas).
 *
 * Kjøres sjelden — resultatet er sjekket inn. Kjør på nytt bare når
 * landlista eller oppløsninga skal endrast:
 *
 *   npm i --no-save world-atlas@2 topojson-client@3
 *   node scripts/build-europe-countries.mjs
 *
 * To ting gjer kartet spelbart i staden for berre korrekt:
 *
 * 1. Transkontinentale land (Russland, Tyrkia, Kasakhstan) er utelatne.
 *    Geometrien deira strekk seg djupt inn i Asia, og `fitExtent` ville
 *    zooma ut til heile Eurasia for å få dei med.
 * 2. Øyer og oversjøiske område utanfor Europa-boksen blir kutta ring for
 *    ring — Kanariøyane, Azorane, Fransk Guyana og Svalbard. Utan dette
 *    krympar fastlandet til ein flekk midt i eit tomt hav.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../src/data/europe/countries.json')

/**
 * ISO 3166-1 numerisk → [norsk namn, engelsk namn].
 *
 * Landsnamn er ikkje proprium på tvers av språk — Tyskland/Germany,
 * Hellas/Greece. Begge blir skrivne til GeoJSON-en, og spelet vel etter
 * aktivt språk. Skrivemodus godtek begge, så ingen mistar poeng på å svare
 * på «feil» språk.
 */
const EUROPE = new Map([
  [8, ['Albania', 'Albania']], [40, ['Østerrike', 'Austria']],
  [56, ['Belgia', 'Belgium']], [70, ['Bosnia-Hercegovina', 'Bosnia and Herzegovina']],
  [100, ['Bulgaria', 'Bulgaria']], [112, ['Hviterussland', 'Belarus']],
  [191, ['Kroatia', 'Croatia']], [196, ['Kypros', 'Cyprus']],
  [203, ['Tsjekkia', 'Czechia']], [208, ['Danmark', 'Denmark']],
  [233, ['Estland', 'Estonia']], [246, ['Finland', 'Finland']],
  [250, ['Frankrike', 'France']], [276, ['Tyskland', 'Germany']],
  [300, ['Hellas', 'Greece']], [348, ['Ungarn', 'Hungary']],
  [352, ['Island', 'Iceland']], [372, ['Irland', 'Ireland']],
  [380, ['Italia', 'Italy']], [428, ['Latvia', 'Latvia']],
  [440, ['Litauen', 'Lithuania']], [442, ['Luxembourg', 'Luxembourg']],
  [470, ['Malta', 'Malta']], [498, ['Moldova', 'Moldova']],
  [499, ['Montenegro', 'Montenegro']], [528, ['Nederland', 'Netherlands']],
  [578, ['Norge', 'Norway']], [616, ['Polen', 'Poland']],
  [620, ['Portugal', 'Portugal']], [642, ['Romania', 'Romania']],
  [688, ['Serbia', 'Serbia']], [703, ['Slovakia', 'Slovakia']],
  [705, ['Slovenia', 'Slovenia']], [724, ['Spania', 'Spain']],
  [752, ['Sverige', 'Sweden']], [756, ['Sveits', 'Switzerland']],
  [804, ['Ukraina', 'Ukraine']], [807, ['Nord-Makedonia', 'North Macedonia']],
  [826, ['Storbritannia', 'United Kingdom']],
])

/**
 * Mikrostatane (Vatikanstaten, Monaco, San Marino, Liechtenstein, Andorra) er
 * med vilje utelatne over. I 50m-oppløysing er dei 0,01–0,1° breie — i
 * klikkemodus ville dei vore reine flaksetreff. Dei høyrer heime i ein eigen
 * «mikrostatar»-kategori seinare, ikkje blanda inn blant Frankrike og Polen.
 */

/** Ringar med midtpunkt utanfor denne boksen blir forkasta. */
const BOX = { minLon: -26, maxLon: 46, minLat: 33, maxLat: 72 }

/**
 * Azorane og Madeira ligg innanfor boksen i lengdegrad, men er hundrevis av
 * kilometer ut i Atlanterhavet. Utan denne regelen dreg dei heile kartet
 * vestover. Island (lat 63–67) må overleve, difor breiddegrad-kravet.
 */
function isAtlanticOutlier(lon, lat) {
  return lon < -20 && lat < 55
}

function ringCentreInBox(ring) {
  let lon = 0
  let lat = 0
  for (const [x, y] of ring) {
    lon += x
    lat += y
  }
  lon /= ring.length
  lat /= ring.length
  if (isAtlanticOutlier(lon, lat)) return false
  return (
    lon >= BOX.minLon && lon <= BOX.maxLon && lat >= BOX.minLat && lat <= BOX.maxLat
  )
}

/** Behald berre dei polygona som faktisk ligg i Europa. */
function clipToEurope(geometry) {
  if (geometry.type === 'Polygon') {
    return ringCentreInBox(geometry.coordinates[0]) ? geometry : null
  }
  const kept = geometry.coordinates.filter((polygon) => ringCentreInBox(polygon[0]))
  if (kept.length === 0) return null
  return kept.length === 1
    ? { type: 'Polygon', coordinates: kept[0] }
    : { type: 'MultiPolygon', coordinates: kept }
}

/** Kuttar koordinatpresisjonen — 3 desimalar er ~100 m, meir enn nok her. */
function round(value) {
  return Math.round(value * 1000) / 1000
}

function roundGeometry(geometry) {
  const walk = (node) =>
    typeof node[0] === 'number' ? [round(node[0]), round(node[1])] : node.map(walk)
  return { ...geometry, coordinates: walk(geometry.coordinates) }
}

const topology = JSON.parse(
  readFileSync(resolve(here, '../node_modules/world-atlas/countries-50m.json'), 'utf8'),
)
const world = feature(topology, topology.objects.countries)

const features = []
const missing = new Set(EUROPE.keys())

for (const f of world.features) {
  const code = Number(f.id)
  if (!EUROPE.has(code)) continue
  missing.delete(code)

  const [name, nameEn] = EUROPE.get(code)
  const clipped = clipToEurope(f.geometry)
  if (!clipped) {
    console.warn(`  ! ${name} fell utanfor Europa-boksen — hoppa over`)
    continue
  }

  features.push({
    type: 'Feature',
    properties: { id: String(code), name, nameEn },
    geometry: roundGeometry(clipped),
  })
}

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features }))

console.log(`Skreiv ${features.length} land til ${OUT}`)
if (missing.size > 0) {
  const names = [...missing].map((c) => `${EUROPE.get(c)[0]} (${c})`).join(', ')
  console.warn(`Fanst ikkje i datasettet: ${names}`)
}
