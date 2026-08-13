/**
 * Genererer datasetta til Asia-regionen under src/data/asia/.
 *
 *   npm i --no-save world-atlas@2 topojson-client@3
 *   npm run data:asia
 *
 * Resultatet er sjekka inn. Kjør på nytt berre når lista over land, hovudstader,
 * elver eller fjell skal endrast.
 *
 * RUSSLAND ER IKKJE MED. Det er eit medvite val, same valet som
 * `build-europe-countries.mjs` tok for Europa: geometrien strekk seg frå 20°Ø
 * til over datolinja, og `fitExtent` ville zooma ut til heile den nordlege
 * halvkula for å få henne med. Resten av Asia hadde blitt uspelbart lite.
 * Russland høyrer heime i eit eige nordleg kart, ikkje som ein flekk som et
 * opp to kontinent.
 */

import { resolve } from 'node:path'
import { feature } from 'topojson-client'
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

const OUT = resolve(ROOT, 'src/data/asia')

/**
 * Ringar med midtpunkt utanfor denne boksen blir forkasta.
 *
 * Vestgrensa 25°Ø tek med Trakia, den europeiske delen av Tyrkia. Austgrensa
 * 150°Ø tek med Hokkaido og Papua, men lèt japanske stillehavsøyer som
 * Minamitorishima (154°Ø) ligge — dei ville dratt kartet ut i havet.
 */
const BOX = { minLon: 25, maxLon: 150, minLat: -12, maxLat: 56 }

/**
 * ISO 3166-1 numerisk → [norsk namn, engelsk namn].
 *
 * Bahrain, Singapore og Maldivane er utelatne. I 50m-oppløysing er dei nokre
 * få piksler breie — i klikkemodus ville dei vore reine flaksetreff, same
 * grunnen til at mikrostatane i Europa ikkje er med.
 */
const COUNTRIES = new Map([
  [4, ['Afghanistan', 'Afghanistan']], [31, ['Aserbajdsjan', 'Azerbaijan']],
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
  [792, ['Tyrkia', 'Turkey']], [795, ['Turkmenistan', 'Turkmenistan']],
  [860, ['Usbekistan', 'Uzbekistan']], [887, ['Jemen', 'Yemen']],
])

/** ISO-3 landkode → [id, norsk namn, engelsk namn] for hovudstaden. */
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
 * Elver, med Natural Earth sine segmentnamn.
 *
 * Ei elv ligg ikkje i datasettet som éin strek. Yangtze er delt i Tuotuo,
 * Tongtian, Jinsha og Yangtze — kvar strekninga med sitt lokale namn. For
 * spelet er dei same elva, så segmenta blir slåtte saman til éin feature.
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

/** Fjell, med namnet dei har i Natural Earth sitt høgdepunkt-datasett. */
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
  // Kangchenjunga og Annapurna manglar i Natural Earth-utvalet. Dei er for
  // kjende til å utelate, så koordinatane står her.
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
    const clipped = clipPolygonToBox(f.geometry, BOX)
    if (!clipped) {
      console.warn(`  ! ${name} fall utanfor Asia-boksen — hoppa over`)
      continue
    }
    // Asia er stort: heile regionen blir pressa inn i 900 px høgd, så 2
    // desimalar (~1 km) er alt kartet klarer å vise uansett.
    features.push({
      type: 'Feature',
      properties: { id: String(code), name, nameEn },
      geometry: dropRepeats(roundGeometry(clipped, 2)),
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'countries.json'), features)
  if (missing.size > 0) {
    console.warn(
      `  ! fanst ikkje i datasettet: ${[...missing].map((c) => COUNTRIES.get(c)[0]).join(', ')}`,
    )
  }
}

async function buildCapitals() {
  const places = await naturalEarth('ne_50m_populated_places')
  const features = []
  const missing = new Set(CAPITALS.keys())

  for (const f of places.features) {
    const p = f.properties
    // `missing` er òg vaktposten mot doble treff: nokre land har meir enn éin
    // hovudstad i datasettet, og spelet toler ikkje to features med same id.
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
  if (missing.size > 0) console.warn(`  ! utan treff: ${[...missing].join(', ')}`)
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
      console.warn(`  ! ingen segment for ${river.name}`)
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
      console.warn(`  ! fann ikkje ${peak.name} (${peak.source})`)
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
