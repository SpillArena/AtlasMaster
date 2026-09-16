/**
 * Genererer datasettene til Sør-Amerika-regionen under src/data/south-america/.
 *
 *   npm i --no-save world-atlas@2 topojson-client@3
 *   npm run data:south-america
 *
 * Resultatet er sjekket inn. Kjør på nytt bare når lista over land, hovedsteder,
 * elver eller fjell skal endres.
 */

import { resolve } from 'node:path'
import { feature } from 'topojson-client'
import rewind from '@mapbox/geojson-rewind'
import {
  ROOT,
  clipLineToBoxes,
  clipPolygonToBox,
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

const OUT = resolve(ROOT, 'src/data/south-america')

/**
 * Ringer med midtpunkt utenfor denne boksen blir forkastet.
 *
 * Vestgrensa −82°Ø tar med Galápagos (Ecuador). Østgrensa −33°Ø tar med
 * Brasils atlanterhavstipp ved Recife/João Pessoa. Sørgrensa −56° tar med
 * Ildlandet; nordgrensa 13° tar med Colombia og Venezuelas karibiske kyst.
 */
const BOX = { minLon: -82, maxLon: -33, minLat: -56, maxLat: 13 }

/**
 * ISO 3166-1 numerisk → [norsk navn, engelsk navn].
 *
 * De tolv suverene statene i Sør-Amerika. Fransk Guyana (254) er utelatt —
 * det er ikke en egen stat, men en del av Frankrike, på samme måte som
 * Vest-Sahara er utelatt fra Afrika. Falklandsøyene (238) er britisk og
 * omstridt og er heller ikke med, samme vurdering som holder dem utenfor
 * verdenskartets flaggsett.
 */
const COUNTRIES = new Map([
  [32, ['Argentina', 'Argentina']],
  [68, ['Bolivia', 'Bolivia']],
  [76, ['Brasil', 'Brazil']],
  [152, ['Chile', 'Chile']],
  [170, ['Colombia', 'Colombia']],
  [218, ['Ecuador', 'Ecuador']],
  [328, ['Guyana', 'Guyana']],
  [600, ['Paraguay', 'Paraguay']],
  [604, ['Peru', 'Peru']],
  [740, ['Surinam', 'Suriname']],
  [858, ['Uruguay', 'Uruguay']],
  [862, ['Venezuela', 'Venezuela']],
])

/**
 * ISO-3 landkode → [norsk navn, engelsk navn] for hovedstaden.
 *
 * Bolivia er særtilfellet: den grunnlovfestede hovedstaden er Sucre, men
 * regjeringen og de fleste ambassadene sitter i La Paz. `ne_50m_populated_places`
 * flagger La Paz som `ADM0CAP`, og det er også svaret de fleste geografiquizer
 * bruker, så det er valget her.
 */
const CAPITALS = new Map([
  ['ARG', ['Buenos Aires', 'Buenos Aires']],
  ['BOL', ['La Paz', 'La Paz']],
  ['BRA', ['Brasília', 'Brasília']],
  ['CHL', ['Santiago', 'Santiago']],
  ['COL', ['Bogotá', 'Bogotá']],
  ['ECU', ['Quito', 'Quito']],
  ['GUY', ['Georgetown', 'Georgetown']],
  ['PRY', ['Asunción', 'Asunción']],
  ['PER', ['Lima', 'Lima']],
  ['SUR', ['Paramaribo', 'Paramaribo']],
  ['URY', ['Montevideo', 'Montevideo']],
  ['VEN', ['Caracas', 'Caracas']],
])

/**
 * Elver, med Natural Earths segmentnavn.
 *
 * Amazonas er delt opp akkurat som Nilen i Afrika: øvre løp gjennom Peru
 * heter «Maranon» i kildedataene, ikke «Amazon», før elva tar navnet sitt
 * ved samløpet med Ucayali.
 */
const RIVERS = [
  { id: 'Amazonas', name: 'Amazonas', nameEn: 'Amazon', parts: ['Amazonas', 'Maranon', 'Ucayali'] },
  { id: 'Parana', name: 'Paraná', parts: ['Paraná'] },
  { id: 'Orinoco', name: 'Orinoco', parts: ['Orinoco'] },
  { id: 'Uruguayelva', name: 'Uruguayelva', nameEn: 'Uruguay River', parts: ['Uruguay'] },
  { id: 'Madeira', name: 'Madeira', parts: ['Madeira'] },
  { id: 'Tocantins', name: 'Tocantins', parts: ['Tocantins'] },
  { id: 'SaoFrancisco', name: 'São Francisco', parts: ['São Francisco'] },
  { id: 'Magdalena', name: 'Magdalena', parts: ['Magdalena'] },
]

/** Elvenavn som bare finnes i det finere 10m-datasettet, ikke i 50m. */
const RIVER_FALLBACK_SOURCE = 'ne_10m_rivers_lake_centerlines'

/**
 * Fjell, med navnet de har i Natural Earths høydepunkt-datasett.
 *
 * Monte Pissis finnes ikke i utvalget i det hele tatt, samme situasjon som
 * Mount Meru i Afrika. Koordinatene står derfor rett i lista, med `at`.
 */
const PEAKS = [
  { source: 'Cerro Aconcagua', id: 'Aconcagua', name: 'Aconcagua' },
  { source: 'Nevado Ojos del Salado', id: 'OjosDelSalado', name: 'Ojos del Salado' },
  { id: 'MontePissis', name: 'Monte Pissis', at: [-68.8, -27.75] },
  { source: 'Nevado Huascarán', id: 'Huascaran', name: 'Huascarán' },
  { source: 'Nevado Sajama', id: 'Sajama', name: 'Sajama' },
  { source: 'Chimborazo', id: 'Chimborazo', name: 'Chimborazo' },
  { source: 'Pico da Neblina', id: 'PicoDaNeblina', name: 'Pico da Neblina' },
  { source: 'Pico Bolívar', id: 'PicoBolivar', name: 'Pico Bolívar' },
  { source: 'Pico Cristóbal Colón', id: 'PicoCristobalColon', name: 'Pico Cristóbal Colón' },
]

async function buildCountries() {
  const topology = fromNodeModules('world-atlas/countries-50m.json')
  const world = feature(topology, topology.objects.countries)
  const features = []
  const missing = new Set(COUNTRIES.keys())

  for (const f of world.features) {
    const code = Number(f.id)
    if (!COUNTRIES.has(code)) continue
    missing.delete(code)
    const [name, nameEn] = COUNTRIES.get(code)
    const clipped = clipPolygonToBox(f.geometry, BOX)
    if (!clipped) {
      console.warn(`  ! ${name} falt utenfor Sør-Amerika-boksen — hoppet over`)
      continue
    }
    // Samme vurdering som Afrika/Asia: 2 desimaler (~1 km) er alt kartet
    // klarer å vise når hele regionen presses inn i noen hundre piksler.
    //
    // Id-en er nullpolstret til tre siffer, i motsetning til Asia. Verdens-
    // flaggsettet i src/data/world/flags.json er nøkla på tresifrede koder
    // ("032", "068", "076"), og `southAmericaFlags`-kategorien slår opp
    // `properties.id` der direkte.
    features.push({
      type: 'Feature',
      properties: { id: String(code).padStart(3, '0'), name, nameEn },
      geometry: dropRepeats(roundGeometry(clipped, 2)),
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(
    resolve(OUT, 'countries.json'),
    rewind({ type: 'FeatureCollection', features }, true).features,
  )
  if (missing.size > 0) {
    console.warn(
      `  ! fantes ikke i datasettet: ${[...missing].map((c) => COUNTRIES.get(c)[0]).join(', ')}`,
    )
  }
}

async function buildCapitals() {
  const places = await naturalEarth('ne_50m_populated_places')
  const features = []
  const missing = new Set(CAPITALS.keys())

  for (const f of places.features) {
    const p = f.properties
    if (p.ADM0CAP !== 1 || !missing.has(p.ADM0_A3)) continue
    missing.delete(p.ADM0_A3)
    const [name, nameEn] = CAPITALS.get(p.ADM0_A3)
    features.push({
      type: 'Feature',
      properties: { id: name.replace(/[^A-Za-z]/g, ''), name, nameEn },
      geometry: roundGeometry(f.geometry),
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'capitals.json'), features)
  if (missing.size > 0) console.warn(`  ! uten treff: ${[...missing].join(', ')}`)
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

  let fine = null
  async function fineSegmentsFor(key) {
    if (!fine) fine = await naturalEarth(RIVER_FALLBACK_SOURCE)
    return fine.features.filter((f) => normaliseName(f.properties.name) === key)
  }

  const features = []
  for (const river of RIVERS) {
    const parts = []
    for (const partName of river.parts) {
      let matches = segments.get(partName) ?? []
      if (matches.length === 0) matches = await fineSegmentsFor(partName)
      for (const f of matches) {
        for (const line of lineStrings(f.geometry)) {
          for (const piece of clipLineToBoxes(line, [BOX])) {
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
      properties: {
        id: river.id,
        name: river.name,
        ...(river.nameEn ? { nameEn: river.nameEn } : {}),
      },
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
  for (const peak of PEAKS) {
    const coordinates = peak.at ?? byName.get(peak.source)?.geometry.coordinates
    if (!coordinates) {
      console.warn(`  ! fant ikke ${peak.name} (${peak.source})`)
      continue
    }
    features.push({
      type: 'Feature',
      properties: {
        id: peak.id,
        name: peak.name,
        ...(peak.nameEn ? { nameEn: peak.nameEn } : {}),
      },
      geometry: { type: 'Point', coordinates: coordinates.map((c) => round(c)) },
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'peaks.json'), features)
}

console.log('Sør-Amerika:')
await buildCountries()
await buildCapitals()
await buildRivers()
await buildPeaks()
