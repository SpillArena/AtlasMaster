/**
 * Genererer datasettene til Asia-regionen under src/data/asia/.
 *
 *   npm i --no-save world-atlas@2 topojson-client@3
 *   npm run data:asia
 *
 * Resultatet er sjekket inn. Kjør på nytt bare når lista over land, hovedsteder,
 * elver eller fjell skal endres.
 *
 * RUSSLAND BLIR KUTTET, IKKE UTELATT. Hele geometrien strekker seg fra 20°Ø
 * til over datolinja, og `fitExtent` ville zoomet ut til hele den nordlige
 * halvkula for å få den med — resten av Asia hadde blitt uspillbart lite.
 * Landet blir derfor klippet geometrisk mot en egen boks, slik det også blir i
 * Europa-kartet, så det er svarbart i begge regioner uten å ete opp noen av
 * dem. Se RUSSIA_BOX under.
 */

import { resolve } from 'node:path'
import { feature } from 'topojson-client'
import rewind from '@mapbox/geojson-rewind'
import {
  ROOT,
  clipGeometryToBox,
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

const OUT = resolve(ROOT, 'src/data/asia')

/**
 * Ringer med midtpunkt utenfor denne boksen blir forkastet.
 *
 * Vestgrensa 25°Ø tar med Trakia, den europeiske delen av Tyrkia. Østgrensa
 * 150°Ø tar med Hokkaido og Papua, men lar japanske stillehavsøyer som
 * Minamitorishima (154°Ø) ligge — de ville dratt kartet ut i havet.
 */
const BOX = { minLon: 25, maxLon: 150, minLat: -12, maxLat: 56 }

/**
 * ISO 3166-1 numerisk → [norsk navn, engelsk navn].
 *
 * Bahrain, Singapore og Maldivene var utelatt her før, fordi de er noen få
 * piksler brede og i klikkemodus ville vært rene flaksetreff. Feilen lå i
 * kartet, ikke i lista: flatene hadde ikke noe minstemål for trykk.
 * `SmallTargets` i components/game/MapCanvas.tsx gir dem det nå, og da er
 * grunnen til å holde dem ute borte. Se samme notatet i
 * build-europe-countries.mjs.
 */
const COUNTRIES = new Map([
  [4, ['Afghanistan', 'Afghanistan']], [31, ['Aserbajdsjan', 'Azerbaijan']],
  [48, ['Bahrain', 'Bahrain']], [462, ['Maldivene', 'Maldives']],
  [702, ['Singapore', 'Singapore']],
  [50, ['Bangladesh', 'Bangladesh']], [51, ['Armenia', 'Armenia']],
  [64, ['Bhutan', 'Bhutan']], [96, ['Brunei', 'Brunei']],
  [104, ['Myanmar', 'Myanmar']], [116, ['Kambodsja', 'Cambodia']],
  [144, ['Sri Lanka', 'Sri Lanka']], [156, ['Kina', 'China']],
  [158, ['Taiwan', 'Taiwan']], [268, ['Georgia', 'Georgia']],
  [356, ['India', 'India']], [360, ['Indonesia', 'Indonesia']],
  [364, ['Iran', 'Iran']], [368, ['Irak', 'Iraq']],
  [376, ['Israel', 'Israel']], [392, ['Japan', 'Japan']],
  [398, ['Kasakhstan', 'Kazakhstan']], [400, ['Jordan', 'Jordan']],
  [408, ['Nord-Korea', 'North Korea']], [410, ['Sør-Korea', 'South Korea']],
  [414, ['Kuwait', 'Kuwait']], [417, ['Kirgisistan', 'Kyrgyzstan']],
  [418, ['Laos', 'Laos']], [422, ['Libanon', 'Lebanon']],
  [458, ['Malaysia', 'Malaysia']], [496, ['Mongolia', 'Mongolia']],
  [512, ['Oman', 'Oman']], [524, ['Nepal', 'Nepal']],
  [586, ['Pakistan', 'Pakistan']], [608, ['Filippinene', 'Philippines']],
  [626, ['Øst-Timor', 'Timor-Leste']], [634, ['Qatar', 'Qatar']],
  [682, ['Saudi-Arabia', 'Saudi Arabia']], [704, ['Vietnam', 'Vietnam']],
  [760, ['Syria', 'Syria']], [762, ['Tadsjikistan', 'Tajikistan']],
  [764, ['Thailand', 'Thailand']], [784, ['Emiratene', 'United Arab Emirates']],
  [643, ['Russland', 'Russia']],
  [792, ['Tyrkia', 'Turkey']], [795, ['Turkmenistan', 'Turkmenistan']],
  [860, ['Usbekistan', 'Uzbekistan']], [887, ['Jemen', 'Yemen']],
])

const RUSSIA = 643

/**
 * Russlands eget utsnitt.
 *
 * Nordgrensa er valgt, ikke funnet: hele Sibir går til 77°N, og tar vi det
 * med, vokser utsnittet fra 67 til 89 breddegrader og alt fra Java til Japan
 * krymper med en fjerdedel for et land som uansett bare trenger å være
 * treffbart. 58°N gir et belte fra Kaukasus og Volga i vest, over
 * Vest-Sibir og Bajkal, til Amur i øst — større flate enn Mongolia, og under
 * fem prosent ekstra utsnitt.
 *
 * Østgrensa 150°Ø er den samme som resten av regionen. Den er også det som holder
 * datolinja unna: Tsjuktsjarhalvøya og Kamtsjatka ligger øst for den og faller
 * bort i klippinga, i stedet for å bli et smett tvers over kartet.
 */
const RUSSIA_BOX = { minLon: 25, maxLon: 150, minLat: 40, maxLat: 58 }

/** ISO-3 landkode → [id, norsk navn, engelsk navn] for hovedstaden. */
const CAPITALS = new Map([
  ['AFG', ['Kabul', 'Kabul']], ['ARM', ['Jerevan', 'Yerevan']],
  ['AZE', ['Baku', 'Baku']], ['BGD', ['Dhaka', 'Dhaka']],
  ['BTN', ['Thimphu', 'Thimphu']], ['BRN', ['Bandar Seri Begawan', 'Bandar Seri Begawan']],
  ['KHM', ['Phnom Penh', 'Phnom Penh']], ['CHN', ['Beijing', 'Beijing']],
  ['TWN', ['Taipei', 'Taipei']], ['GEO', ['Tbilisi', 'Tbilisi']],
  ['IND', ['New Delhi', 'New Delhi']], ['IDN', ['Jakarta', 'Jakarta']],
  ['IRN', ['Teheran', 'Tehran']], ['IRQ', ['Bagdad', 'Baghdad']],
  ['ISR', ['Jerusalem', 'Jerusalem']], ['JPN', ['Tokyo', 'Tokyo']],
  ['JOR', ['Amman', 'Amman']], ['KAZ', ['Astana', 'Astana']],
  ['KWT', ['Kuwait by', 'Kuwait City']], ['KGZ', ['Bisjkek', 'Bishkek']],
  ['LAO', ['Vientiane', 'Vientiane']], ['LBN', ['Beirut', 'Beirut']],
  ['MYS', ['Kuala Lumpur', 'Kuala Lumpur']], ['MNG', ['Ulaanbaatar', 'Ulaanbaatar']],
  ['MMR', ['Naypyidaw', 'Naypyidaw']], ['NPL', ['Katmandu', 'Kathmandu']],
  ['PRK', ['Pyongyang', 'Pyongyang']], ['KOR', ['Seoul', 'Seoul']],
  ['OMN', ['Muskat', 'Muscat']], ['PAK', ['Islamabad', 'Islamabad']],
  ['PHL', ['Manila', 'Manila']], ['QAT', ['Doha', 'Doha']],
  ['SAU', ['Riyadh', 'Riyadh']], ['LKA', ['Colombo', 'Colombo']],
  ['SYR', ['Damaskus', 'Damascus']], ['TJK', ['Dusjanbe', 'Dushanbe']],
  ['THA', ['Bangkok', 'Bangkok']], ['TLS', ['Dili', 'Dili']],
  ['TUR', ['Ankara', 'Ankara']], ['TKM', ['Asjgabat', 'Ashgabat']],
  ['ARE', ['Abu Dhabi', 'Abu Dhabi']], ['UZB', ['Tasjkent', 'Tashkent']],
  ['VNM', ['Hanoi', 'Hanoi']], ['YEM', ['Sanaa', 'Sanaa']],
])

/**
 * Elver, med Natural Earths segmentnavn.
 *
 * En elv ligger ikke i datasettet som én strek. Yangtze er delt i Tuotuo,
 * Tongtian, Jinsha og Yangtze — hver strekning med sitt lokale navn. For
 * spillet er de samme elva, så segmentene blir slått sammen til én feature.
 */
const RIVERS = [
  { id: 'Yangtze', name: 'Yangtze', parts: ['Yangtze', 'Chang Jiang', 'Jinsha', 'Tongtian', 'Tuotuo'] },
  { id: 'HuangHe', name: 'Huang He', nameEn: 'Yellow River', parts: ['Huang'] },
  { id: 'Mekong', name: 'Mekong', parts: ['Mekong', 'Lancang'] },
  { id: 'Ganges', name: 'Ganges', parts: ['Ganges'] },
  { id: 'Brahmaputra', name: 'Brahmaputra', parts: ['Brahmaputra', 'Yarlung', 'Dihang', 'Maquan'] },
  { id: 'Indus', name: 'Indus', parts: ['Indus', 'Shiquan'] },
  { id: 'Eufrat', name: 'Eufrat', nameEn: 'Euphrates', parts: ['Euphrates', 'Al Furat', 'Firat'] },
  { id: 'Tigris', name: 'Tigris', parts: ['Tigris', 'Dicle'] },
  { id: 'Irrawaddy', name: 'Irrawaddy', nameEn: 'Ayeyarwady', parts: ['Ayeyarwady', 'Irrawaddy Delta', 'Nmai'] },
  { id: 'Salween', name: 'Salween', parts: ['Salween', 'Nu'] },
  { id: 'AmuDarja', name: 'Amu-Darja', nameEn: 'Amu Darya', parts: ['Amu Darya', 'Panj'] },
  { id: 'SyrDarja', name: 'Syr-Darja', nameEn: 'Syr Darya', parts: ['Syr Darya', 'Naryn'] },
  { id: 'Amur', name: 'Amur', parts: ['Amur', 'Heilong Jiang'] },
  { id: 'Tarim', name: 'Tarim', parts: ['Tarim', 'Yarkant'] },
]

/** Fjell, med navnet de har i Natural Earths høydepunkt-datasett. */
const PEAKS = [
  { source: 'Mount Everest', id: 'MountEverest', name: 'Mount Everest' },
  { source: 'K2', id: 'K2', name: 'K2' },
  { source: 'Nanga Parbat', id: 'NangaParbat', name: 'Nanga Parbat' },
  { source: 'Tirich Mir', id: 'TirichMir', name: 'Tirich Mir' },
  { source: 'Pik Pobeda', id: 'JengishChokusu', name: 'Jengish Chokusu' },
  { source: 'Fuji', id: 'Fuji', name: 'Fuji' },
  { source: 'Mount Damavand', id: 'Damavand', name: 'Damavand' },
  { source: 'Mount Ararat', id: 'Ararat', name: 'Ararat' },
  { source: 'Gunung Kinabalu', id: 'Kinabalu', name: 'Kinabalu' },
  { source: 'Puncak Jaya', id: 'PuncakJaya', name: 'Puncak Jaya' },
  { source: 'Paektu-san', id: 'Paektusan', name: 'Paektu-san', nameEn: 'Baekdu' },
  { source: 'Halla-san', id: 'Hallasan', name: 'Halla-san', nameEn: 'Hallasan' },
  { source: 'Yu Shan', id: 'YuShan', name: 'Yu Shan' },
  { source: 'Doi Inthanon', id: 'DoiInthanon', name: 'Doi Inthanon' },
  { source: 'Fan Si Pan', id: 'FanSiPan', name: 'Fan Si Pan' },
  // Kangchenjunga og Annapurna mangler i Natural Earth-utvalget. De er for
  // kjente til å utelate, så koordinatene står her.
  { id: 'Kangchenjunga', name: 'Kangchenjunga', at: [88.147, 27.702] },
  { id: 'Annapurna', name: 'Annapurna', at: [83.82, 28.596] },
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
    const clipped =
      code === RUSSIA
        ? clipGeometryToBox(f.geometry, RUSSIA_BOX)
        : clipPolygonToBox(f.geometry, BOX)
    if (!clipped) {
      console.warn(`  ! ${name} falt utenfor Asia-boksen — hoppet over`)
      continue
    }
    // Asia er stort: hele regionen blir presset inn i 900 px høyde, så 2
    // desimaler (~1 km) er alt kartet klarer å vise uansett.
    features.push({
      type: 'Feature',
      properties: { id: String(code), name, nameEn },
      geometry: dropRepeats(roundGeometry(clipped, 2)),
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  /*
   * d3-geo leser et polygon sfærisk: hvilken side av ringen som er «inne» følger
   * av hvilken vei den går. En ytterring som går feil vei blir tegnet som resten
   * av kloden. Klippingen holder orienteringen, men samlingen blir normalisert til
   * med klokka rundt ytterringen uansett — den konvensjonen d3 regner med.
   */
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
    // `missing` er også vaktposten mot doble treff: noen land har mer enn én
    // hovedstad i datasettet, og spillet tåler ikke to features med samme id.
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

  const features = []
  for (const river of RIVERS) {
    const parts = []
    for (const partName of river.parts) {
      for (const f of segments.get(partName) ?? []) {
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

console.log('Asia:')
await buildCountries()
await buildCapitals()
await buildRivers()
await buildPeaks()
