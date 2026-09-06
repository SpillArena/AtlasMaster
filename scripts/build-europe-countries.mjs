/**
 * Genererer src/data/europe/countries.json fra Natural Earth (via world-atlas).
 *
 * Kjøres sjelden — resultatet er sjekket inn. Kjør på nytt bare når
 * landlista eller oppløsningen skal endres:
 *
 *   npm i --no-save world-atlas@2 topojson-client@3
 *   node scripts/build-europe-countries.mjs
 *
 * Tre ting gjør kartet spillbart i stedet for bare korrekt:
 *
 * 1. Tyrkia og Kasakhstan er utelatt. Geometrien deres strekker seg dypt inn
 *    i Asia, og `fitExtent` ville zoomet ut til hele Eurasia for å få dem med.
 * 2. Øyer og oversjøiske områder utenfor Europa-boksen blir kuttet ring for
 *    ring — Kanariøyene, Azorene, Fransk Guyana og Svalbard. Uten dette
 *    krymper fastlandet til en flekk midt i et tomt hav.
 * 3. Russland blir *kuttet*, ikke utelatt. Se RUSSIA under.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import rewind from '@mapbox/geojson-rewind'
import { clipGeometryToBox } from './lib/sources.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../src/data/europe/countries.json')

/**
 * ISO 3166-1 numerisk → [norsk navn, engelsk navn].
 *
 * Landsnavn er ikke proprium på tvers av språk — Tyskland/Germany,
 * Hellas/Greece. Begge blir skrevet til GeoJSON-en, og spillet velger etter
 * aktivt språk. Skrivemodus godtar begge, så ingen mister poeng på å svare
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
  [643, ['Russland', 'Russia']],
  // mikrostatene — se kommentaren under
  [20, ['Andorra', 'Andorra']], [336, ['Vatikanstaten', 'Vatican City']],
  [438, ['Liechtenstein', 'Liechtenstein']], [492, ['Monaco', 'Monaco']],
  [674, ['San Marino', 'San Marino']],
  [826, ['Storbritannia', 'United Kingdom']],
])

/**
 * Russland er det eneste landet som blir kuttet tvers gjennom.
 *
 * Ringtesten de andre landene går gjennom spør om midtpunktet i en ring ligger
 * i Europa. For Russland svarer den «nei» — tyngdepunktet i ytterringen ligger
 * i Sibir — og landet forsvinner helt. Det er slik det har vært til nå, og
 * grunnen til at Russland ikke har vært et svar i noen av de to
 * regionene.
 *
 * Landet blir i stedet klippet geometrisk mot den *samme* boksen resten av
 * Europa holder seg innenfor. Da endrer utsnittet seg nesten ikke — den
 * østligste andre geometrien er Ukraina på 40°Ø — og den russiske flata
 * fyller hjørnet nordøst, med kanten sin akkurat der kartet uansett slutter.
 *
 * Kuttet er også det som holder datolinja unna: den russiske ytterringen går
 * forbi 180°, og et polygon som krysser antimeridianen legger seg som en
 * stripe tvers over hele kartet. Her stopper geometrien på 46°Ø.
 */
const RUSSIA = 643

/**
 * Mikrostatene var utelatt her før, og begrunnelsen var god: de er noen få
 * piksler brede, og i klikkemodus ville de vært rene flaksetreff.
 *
 * Det var ikke datasettet som var feil, men kartet. Polygonene hadde ikke noe
 * minstemål for trykk — elvene hadde et usynlig band og byene en usynlig
 * sirkel, flatene ingenting. `SmallTargets` i components/game/MapCanvas.tsx
 * gir nå hver flate som er mindre enn fingertuppen en usynlig treffflate, og
 * da er ikke San Marino vanskeligere å treffe enn Oslo er. Grunnen til å
 * holde dem ute er borte, og Europa har alle landene sine.
 *
 * Kosovo har ingen offisiell numerisk kode og blir kjent igjen på navnet.
 */
const KOSOVO = { id: 'XK', name: 'Kosovo', nameEn: 'Kosovo' }

/** Ringer med midtpunkt utenfor denne boksen blir forkastet. */
const BOX = { minLon: -26, maxLon: 46, minLat: 33, maxLat: 72 }

/**
 * Azorene og Madeira ligger innenfor boksen i lengdegrad, men er hundrevis av
 * kilometer ut i Atlanterhavet. Uten denne regelen drar de hele kartet
 * vestover. Island (lat 63–67) må overleve, derfor breddegrad-kravet.
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

/** Behold bare de polygonene som faktisk ligger i Europa. */
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

/** Kutter koordinatpresisjonen — 3 desimaler er ~100 m, mer enn nok her. */
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
  const kosovo = f.id == null && f.properties?.name === 'Kosovo'
  const code = Number(f.id)
  if (!kosovo && !EUROPE.has(code)) continue
  missing.delete(code)

  const [name, nameEn] = kosovo ? [KOSOVO.name, KOSOVO.nameEn] : EUROPE.get(code)
  const clipped = code === RUSSIA ? clipGeometryToBox(f.geometry, BOX) : clipToEurope(f.geometry)
  if (!clipped) {
    console.warn(`  ! ${name} falt utenfor Europa-boksen — hoppet over`)
    continue
  }

  features.push({
    type: 'Feature',
    properties: { id: kosovo ? KOSOVO.id : String(code), name, nameEn },
    geometry: roundGeometry(clipped),
  })
}

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))

mkdirSync(dirname(OUT), { recursive: true })
/*
 * d3-geo leser et polygon sfærisk: hvilken side av ringen som er «inne» følger av
 * hvilken vei den går. En ytterring som går feil vei blir tegnet som *resten av
 * kloden*, og kartet blir et ensfarget rektangel. Klippingen over holder
 * orienteringen, men kilden trenger ikke ha vært konsistent i utgangspunktet,
 * så hele samlingen blir normalisert til med klokka rundt ytterringen — den
 * konvensjonen d3 regner med.
 */
const collection = rewind({ type: 'FeatureCollection', features }, true)
writeFileSync(OUT, JSON.stringify(collection))

console.log(`Skrev ${features.length} land til ${OUT}`)
if (missing.size > 0) {
  const names = [...missing].map((c) => `${EUROPE.get(c)[0]} (${c})`).join(', ')
  console.warn(`Fantes ikke i datasettet: ${names}`)
}
