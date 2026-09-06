/**
 * Genererer datasettene til USA-regionen under src/data/usa/.
 *
 *   npm i --no-save us-atlas@3 topojson-client@3
 *   npm run data:usa
 *
 * Resultatet er sjekket inn. Kjør på nytt bare når lista over stater, byer,
 * elver eller fjell skal endres.
 *
 * Alle 50 statene er med — også Alaska og Hawaii. Det går fordi regionen
 * bruker `albersUsa`, en sammensatt projeksjon som flytter de to inn i hver
 * sin innfelte rute nede til venstre. En vanlig projeksjon hadde måttet velge:
 * enten et kart der de 48 er spillbare og de to mangler, eller et kart som
 * spenner over et halvt jordklode-omløp for å få Alaska med.
 *
 * Territoriene (Puerto Rico, Guam, Jomfruøyene, Amerikansk Samoa, Nord-
 * Marianene) er ikke med: `albersUsa` har ingen rute for dem, og geometrien
 * deres ville forsvunnet sporløst. Washington D.C. er heller ikke en
 * klikkbar «stat» — 0,1° på tvers er ikke et trykkmål — men byen ligger i
 * by-kategorien.
 */

import { resolve } from 'node:path'
import { feature } from 'topojson-client'
import {
  ROOT,
  clipLineToBoxes,
  dropRepeats,
  fromNodeModules,
  lineStrings,
  naturalEarth,
  normaliseName,
  round,
  roundGeometry,
  thinLine,
  writeCollection,
} from './lib/sources.mjs'

const OUT = resolve(ROOT, 'src/data/usa')

/**
 * De tre rutene `albersUsa` faktisk tegner. Alt utenfor dem blir stille
 * borte i projeksjonen, så elvene blir klippet mot akkurat disse — da blir en
 * elv delt der den renner ut av landet, i stedet for å få en rett strek tvers
 * over kartet mellom siste og første synlige punkt.
 */
const US_BOXES = [
  { minLon: -125.1, maxLon: -66.9, minLat: 24.4, maxLat: 49.5 }, // de 48
  { minLon: -172, maxLon: -129, minLat: 51, maxLat: 72 }, // Alaska
  { minLon: -161, maxLon: -154.5, minLat: 18.7, maxLat: 22.5 }, // Hawaii
]

/** FIPS-koder som ikke er stater. DC og territoriene faller bort her. */
const NOT_A_STATE = new Set(['11', '60', '66', '69', '72', '78'])

/** By → delstaten den ligger i, for å skille de mange like bynavnene fra hverandre. */
const CITIES = [
  ['New York', 'New York'],
  ['Los Angeles', 'California'],
  ['Chicago', 'Illinois'],
  ['Houston', 'Texas'],
  ['Phoenix', 'Arizona'],
  ['Philadelphia', 'Pennsylvania'],
  ['San Antonio', 'Texas'],
  ['San Diego', 'California'],
  ['Dallas', 'Texas'],
  ['San Francisco', 'California'],
  ['Seattle', 'Washington'],
  ['Denver', 'Colorado'],
  ['Boston', 'Massachusetts'],
  ['Miami', 'Florida'],
  ['Atlanta', 'Georgia'],
  ['Washington, D.C.', 'District of Columbia'],
  ['Detroit', 'Michigan'],
  ['Minneapolis', 'Minnesota'],
  ['New Orleans', 'Louisiana'],
  ['Las Vegas', 'Nevada'],
  ['Portland', 'Oregon'],
  ['St. Louis', 'Missouri'],
  ['Salt Lake City', 'Utah'],
  ['Kansas City', 'Missouri'],
  ['Anchorage', 'Alaska'],
  ['Honolulu', 'Hawaii'],
]

/**
 * Elver, med Natural Earths segmentnavn.
 *
 * Samme delingen som i Asia: en elv ligger i datasettet som flere strekninger
 * med hvert sitt lokale navn.
 */
const RIVERS = [
  { id: 'Mississippi', name: 'Mississippi', parts: ['Mississippi'] },
  { id: 'Missouri', name: 'Missouri', parts: ['Missouri', 'Madison'] },
  { id: 'Ohio', name: 'Ohio', parts: ['Ohio', 'Allegheny'] },
  { id: 'Colorado', name: 'Colorado', parts: ['Colorado'] },
  { id: 'RioGrande', name: 'Rio Grande', parts: ['Rio Grande'] },
  { id: 'Columbia', name: 'Columbia', parts: ['Columbia'] },
  { id: 'Snake', name: 'Snake', parts: ['Snake'] },
  { id: 'Arkansas', name: 'Arkansas', parts: ['Arkansas'] },
  { id: 'Yukon', name: 'Yukon', parts: ['Yukon', 'Teslin'] },
  { id: 'Tennessee', name: 'Tennessee', parts: ['Tennessee', 'Holston'] },
  { id: 'Hudson', name: 'Hudson', parts: ['Hudson'] },
  { id: 'Sacramento', name: 'Sacramento', parts: ['Sacramento', 'Pit'] },
  { id: 'Brazos', name: 'Brazos', parts: ['Brazos', 'Double Mountain Fork Brazos'] },
  { id: 'Potomac', name: 'Potomac', parts: ['Potomac', 'S. Branch Potomac'] },
]

/** Fjell, med navnet de har i Natural Earths høydepunkt-datasett. */
const PEAKS = [
  'Denali',
  'Mount Whitney',
  'Mount Elbert',
  'Mount Rainier',
  'Mount Shasta',
  'Mount Hood',
  'Grand Teton',
  'Gannett Peak',
  'Mauna Kea',
  'Mount Mitchell',
  'Mount Washington',
]

function buildStates() {
  const topology = fromNodeModules('us-atlas/states-10m.json')
  const states = feature(topology, topology.objects.states)
  const features = []

  for (const f of states.features) {
    const id = String(f.id)
    if (NOT_A_STATE.has(id)) continue
    // 10m-oppløsning er langt finere enn 900 px høyde kan vise. Avrundingen til
    // 2 desimaler (~1 km) snapper alle statene til det samme rutenettet, så
    // felles grenser holder seg tett.
    const geometry = dropRepeats(roundGeometry(f.geometry, 2))
    if (!geometry) {
      console.warn(`  ! ${f.properties.name} ble tom etter avrunding`)
      continue
    }
    features.push({
      type: 'Feature',
      properties: { id, name: f.properties.name },
      geometry,
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'states.json'), features)
  if (features.length !== 50) console.warn(`  ! ventet 50 stater, fikk ${features.length}`)
}

async function buildCities() {
  const places = await naturalEarth('ne_50m_populated_places')
  const features = []

  for (const [name, state] of CITIES) {
    const hit = places.features.find(
      (f) =>
        f.properties.ADM0_A3 === 'USA' &&
        f.properties.ADM1NAME === state &&
        normaliseName(f.properties.NAME) === name,
    )
    if (!hit) {
      console.warn(`  ! fant ikke ${name} (${state})`)
      continue
    }
    features.push({
      type: 'Feature',
      properties: { id: name.replace(/[^A-Za-z]/g, ''), name },
      geometry: roundGeometry(hit.geometry),
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'cities.json'), features)
}

async function buildRivers() {
  const source = await naturalEarth('ne_50m_rivers_lake_centerlines')
  const segments = new Map()
  for (const f of source.features) {
    const key = normaliseName(f.properties.name)
    if (!key) continue
    if (!segments.has(key)) segments.set(key, [])
    segments.get(key).push(f)
  }

  const features = []
  for (const river of RIVERS) {
    const parts = []
    for (const partName of river.parts) {
      for (const f of segments.get(partName) ?? []) {
        for (const line of lineStrings(f.geometry)) {
          for (const piece of clipLineToBoxes(line, US_BOXES)) {
            parts.push(thinLine(piece, 0.05).map(([x, y]) => [round(x, 2), round(y, 2)]))
          }
        }
      }
    }
    if (parts.length === 0) {
      console.warn(`  ! ingen segmenter for ${river.name}`)
      continue
    }
    features.push({
      type: 'Feature',
      properties: { id: river.id, name: river.name },
      geometry:
        parts.length === 1
          ? { type: 'LineString', coordinates: parts[0] }
          : { type: 'MultiLineString', coordinates: parts },
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'rivers.json'), features)
}

async function buildPeaks() {
  const source = await naturalEarth('ne_10m_geography_regions_elevation_points')
  const byName = new Map(
    source.features
      .filter((f) => f.properties.featurecla === 'mountain')
      .map((f) => [normaliseName(f.properties.name), f]),
  )

  const features = []
  for (const name of PEAKS) {
    const hit = byName.get(name)
    if (!hit) {
      console.warn(`  ! fant ikke ${name}`)
      continue
    }
    features.push({
      type: 'Feature',
      properties: { id: name.replace(/[^A-Za-z0-9]/g, ''), name },
      geometry: roundGeometry(hit.geometry),
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'peaks.json'), features)
}

console.log('USA:')
buildStates()
await buildCities()
await buildRivers()
await buildPeaks()
