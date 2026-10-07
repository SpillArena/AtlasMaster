/**
 * Build North America, Oceania, Antarctica and the oceans/known-seas exercise.
 * Run after data:world; the country geometry and padded flag ids are reused
 * from that checked-in build. Natural Earth supplies the other geometry.
 *
 *   node scripts/build-remaining-regions.mjs [north-america|oceania|antarctica|oceans]
 *
 * Outputs are checked in, like the existing continent datasets. Oceania keeps
 * both sides of the date line; its Pacific-centred projection handles them.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import rewind from '@mapbox/geojson-rewind'
import { geoArea } from 'd3-geo'
import {
  ROOT, clipPolygonToBox, clipGeometryToBox, clipLineToBoxes,
  lineStrings, naturalEarth, normaliseName, roundGeometry, thinLine, writeCollection,
} from './lib/sources.mjs'

const northAmerica = {
  dir: 'north-america',
  countries: [28, 44, 52, 84, 124, 188, 192, 212, 214, 222, 308, 320, 332,
    340, 388, 484, 558, 591, 659, 662, 670, 780, 840],
  // Greenland and the Caribbean territories remain scenery, not answers.
  scenery: [304, 660, 533, 60, 92, 136, 531, 500, 630, 652, 663, 666, 534, 796, 850],
  boxes: [
    { minLon: -180, maxLon: -12, minLat: 7, maxLat: 85 },
    { minLon: 170, maxLon: 180, minLat: 50, maxLat: 55 },
  ],
  capitals: {
    ATG: "Saint John's", BHS: 'Nassau', BRB: 'Bridgetown', BLZ: 'Belmopan',
    CAN: 'Ottawa', CRI: 'San José', CUB: ['Havanna', 'Havana'], DMA: 'Roseau',
    DOM: 'Santo Domingo', SLV: 'San Salvador', GRD: "Saint George's",
    GTM: ['Guatemala by', 'Guatemala City'], HTI: 'Port-au-Prince', HND: 'Tegucigalpa',
    JAM: 'Kingston', MEX: ['Mexico by', 'Mexico City'], NIC: 'Managua',
    PAN: ['Panama by', 'Panama City'], KNA: 'Basseterre', LCA: 'Castries',
    VCT: 'Kingstown', TTO: 'Port of Spain', USA: 'Washington, D.C.',
  },
  rivers: ['Mississippi', 'Missouri', 'Mackenzie', 'Yukon', 'St. Lawrence',
    'Colorado', 'Rio Grande', 'Columbia'],
  peaks: ['Denali', 'Mount Logan', 'Pico de Orizaba', 'Volcán Popocatépetl',
    'Mount Whitney', 'Mount Rainier', 'Volcán Tajumulco', 'Pico Duarte'],
}

const oceania = {
  dir: 'oceania',
  countries: [36, 242, 296, 520, 554, 583, 584, 585, 598, 882, 90, 776, 798, 548],
  scenery: [16, 184, 316, 540, 570, 580, 574, 258, 612, 772, 876],
  capitals: {
    AUS: 'Canberra', FJI: 'Suva', KIR: ['Sør-Tarawa', 'South Tarawa'],
    NRU: 'Yaren', NZL: 'Wellington', FSM: 'Palikir', MHL: 'Majuro',
    PLW: 'Ngerulmud', PNG: 'Port Moresby', WSM: 'Apia', SLB: 'Honiara',
    TON: "Nukuʻalofa", TUV: 'Funafuti', VUT: 'Port Vila',
  },
  // Nauru has no official capital; Yaren is the seat of government. Natural
  // Earth still labels Palau's old capital, so use the actual Ngerulmud site.
  capitalOverrides: { NRU: [166.921, -0.547], PLW: [134.624, 7.501] },
  boxes: [
    { minLon: 110, maxLon: 180, minLat: -50, maxLat: 22 },
    { minLon: -180, maxLon: -125, minLat: -50, maxLat: 10 },
  ],
  rivers: ['Murray', 'Darling', 'Waikato', 'Sepik', 'Fly'],
  peaks: ['Mount Kosciuszko', 'Aoraki (Mount Cook)', 'Mount Wilhelm',
    'Mount Ruapehu', 'Tomanivi', 'Mount Tabwemasana', 'Mauga Silisili', 'Ulawun'],
}

const keyFor = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '')
const namesFor = (name) => Array.isArray(name) ? { name: name[0], nameEn: name[1] } : { name, nameEn: name }
const sort = (features) => features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))

function write(dir, file, features) {
  writeCollection(resolve(ROOT, `src/data/${dir}/${file}.json`), sort(features))
}

function requireFeature(feature, label) {
  if (!feature) throw new Error(`Missing source geometry: ${label}`)
  return feature
}

async function buildContinent(config) {
  const world = JSON.parse(readFileSync(resolve(ROOT, 'src/data/world/countries.json'), 'utf8'))
  const byCode = new Map(world.features.map((f) => [Number(f.properties.id), f]))
  const select = (code, playable) => {
    const f = requireFeature(byCode.get(code), code)
    // The USA's Hawaiian islands belong to the separate USA exercise. Keep
    // the mainland and Aleutians here so North America's fit stays usable.
    const geometry = config.dir === 'north-america' && code === 840
      ? clipPolygonToBox(f.geometry, config.boxes[0])
      : f.geometry
    return { ...f, properties: { ...f.properties, playable }, geometry }
  }
  const countries = config.countries.map((code) => select(code, true))
  const outline = [...countries, ...config.scenery.filter((code) => byCode.has(code)).map((code) => select(code, false))]
  write(config.dir, 'countries', countries)
  write(config.dir, 'outline', outline)

  const places = await naturalEarth('ne_50m_populated_places')
  const capitals = Object.entries(config.capitals).map(([code, name]) => {
    const source = places.features.find((f) => f.properties.ADM0CAP === 1 && f.properties.ADM0_A3 === code)
    const coordinates = config.capitalOverrides?.[code] ?? requireFeature(source, `capital ${code}`).geometry.coordinates
    return { type: 'Feature', properties: { id: code, ...namesFor(name) },
      geometry: roundGeometry({ type: 'Point', coordinates }) }
  })
  write(config.dir, 'capitals', capitals)

  const coarse = await naturalEarth('ne_50m_rivers_lake_centerlines')
  let fine
  const rivers = []
  for (const name of config.rivers) {
    let matches = coarse.features.filter((f) => normaliseName(f.properties.name) === name)
    if (!matches.length) {
      fine ??= await naturalEarth('ne_10m_rivers_lake_centerlines')
      matches = fine.features.filter((f) => normaliseName(f.properties.name) === name)
    }
    const parts = matches.flatMap((f) => lineStrings(f.geometry))
      .flatMap((line) => clipLineToBoxes(line, config.boxes))
      .map((line) => thinLine(line, 0.05))
    if (!parts.length) throw new Error(`Missing river: ${name}`)
    rivers.push({ type: 'Feature', properties: { id: keyFor(name), name, nameEn: name },
      geometry: roundGeometry({ type: 'MultiLineString', coordinates: parts }, 2) })
  }
  write(config.dir, 'rivers', rivers)
  await buildPeaks(config.dir, config.peaks)
}

async function buildPeaks(dir, names) {
  const source = await naturalEarth('ne_10m_geography_regions_elevation_points')
  write(dir, 'peaks', names.map((name) => {
    const f = requireFeature(source.features.find((f) => normaliseName(f.properties.name) === name), name)
    return { type: 'Feature', properties: { id: keyFor(name), name, nameEn: name },
      geometry: roundGeometry(f.geometry) }
  }))
}

async function buildAntarctica() {
  const source = await naturalEarth('ne_50m_admin_0_countries')
  const antarctica = requireFeature(source.features.find((f) => f.properties.ADMIN === 'Antarctica'), 'Antarctica')
  const outline = rewind({ type: 'Feature', properties: { id: '010', name: 'Antarktis', nameEn: 'Antarctica', playable: false },
    geometry: roundGeometry(antarctica.geometry, 2) }, true)
  write('antarctica', 'outline', [outline])

  const places = await naturalEarth('ne_50m_populated_places')
  const stations = ['McMurdo Station', 'Amundsen–Scott South Pole Station',
    'Rothera Station', 'Palmer Station', 'Vostok Station', 'Concordia Research Station',
    'Troll Station', 'Casey Station']
  write('antarctica', 'stations', stations.map((name) => {
    const f = requireFeature(places.features.find((f) => f.properties.NAME === name), name)
    return { type: 'Feature', properties: { id: keyFor(name), name, nameEn: name }, geometry: roundGeometry(f.geometry) }
  }))
  await buildPeaks('antarctica', ['Vinson Massif', 'Mount Erebus', 'Mount Sidley',
    'Mount Kirkpatrick', 'Mount Minto', 'Mount Fridtjof Nansen'])
}

// Marine boundaries are GIS lines: a long edge along a parallel must be
// densified before d3 treats it as a great-circle arc (see sources.mjs).
function densify(geometry) {
  const ring = (points) => points.flatMap((a, i) => {
    if (i === points.length - 1) return [a]
    const b = points[i + 1]
    const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 2)
    return Array.from({ length: Math.max(1, steps) }, (_, s) =>
      [a[0] + (b[0] - a[0]) * s / Math.max(1, steps), a[1] + (b[1] - a[1]) * s / Math.max(1, steps)])
  })
  return { ...geometry, coordinates: geometry.type === 'Polygon'
    ? geometry.coordinates.map(ring) : geometry.coordinates.map((p) => p.map(ring)) }
}

async function buildOceans() {
  const marine = await naturalEarth('ne_50m_geography_marine_polys')
  const oceans = [
    ['pacific', 'Stillehavet', 'Pacific Ocean', ['North Pacific Ocean', 'South Pacific Ocean']],
    ['atlantic', 'Atlanterhavet', 'Atlantic Ocean', ['North Atlantic Ocean', 'South Atlantic Ocean']],
    ['indian', 'Indiahavet', 'Indian Ocean', ['INDIAN OCEAN']],
  ].map(([id, name, nameEn, parts]) => {
    const polygons = parts.flatMap((part) => {
      const f = requireFeature(marine.features.find((f) => f.properties.name === part), part)
      const g = requireFeature(clipGeometryToBox(densify(f.geometry),
        { minLon: -180, maxLon: 180, minLat: -60, maxLat: 66.56 }), part)
      return g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    })
    return rewind({ type: 'Feature', properties: { id, name, nameEn, aliases: [nameEn.replace(' Ocean', '')] },
      geometry: roundGeometry({ type: 'MultiPolygon', coordinates: polygons }, 2) }, true)
  })
  // Familiar polar boundaries, without the source's gaps for marginal seas.
  // Land is drawn above the water, so Antarctica and Greenland cannot answer
  // an ocean question. Polar rings close across the date line on the sphere.
  for (const [id, name, nameEn, lat] of [
    ['arctic', 'Nordishavet', 'Arctic Ocean', 66.56],
    ['southern', 'Sørishavet', 'Southern Ocean', -60],
  ]) {
    const ring = Array.from({ length: 181 }, (_, i) => [lat > 0 ? 180 - i * 2 : -180 + i * 2, lat])
    ring.push([...ring[0]])
    oceans.push({ type: 'Feature', properties: { id, name, nameEn,
      aliases: id === 'arctic' ? ['Arctic', 'Polhavet', 'Ishavet'] : ['Southern', 'Antarctic Ocean', 'Antarktishavet'] },
      geometry: { type: 'Polygon', coordinates: [ring] } })
  }
  // A short, familiar selection in the existing Oceans exercise. Keep the
  // source's spherical winding, including Bering Sea's date-line split.
  const seas = [
    ['northSea', 'Nordsjøen', 'North Sea'],
    ['blackSea', 'Svartehavet', 'Black Sea'],
    ['mediterranean', 'Middelhavet', 'Mediterranean Sea', ['Mediterranean']],
    ['southChinaSea', 'Sør-Kina-havet', 'South China Sea', ['Sørkinahavet']],
    ['eastChinaSea', 'Øst-Kina-havet', 'East China Sea', ['Østkinahavet']],
    ['balticSea', 'Østersjøen', 'Baltic Sea'],
    ['redSea', 'Rødehavet', 'Red Sea'],
    ['caribbeanSea', 'Det karibiske hav', 'Caribbean Sea', ['Karibiske hav', 'Karibiskehavet']],
    ['norwegianSea', 'Norskehavet', 'Norwegian Sea'],
    ['arabianSea', 'Arabiahavet', 'Arabian Sea'],
    ['beringSea', 'Beringhavet', 'Bering Sea'],
    ['coralSea', 'Korallhavet', 'Coral Sea'],
  ].map(([id, name, nameEn, aliases = []]) => {
    const source = requireFeature(marine.features.find((f) => f.properties.name === nameEn), nameEn)
    return { type: 'Feature', properties: { id, name, nameEn, aliases },
      geometry: roundGeometry(source.geometry, 3) }
  })
  // SVG paints in dataset order. Seas must sit above the broader ocean
  // basins, especially where Norskehavet overlaps the Arctic cap.
  writeCollection(resolve(ROOT, 'src/data/world/oceans.json'),
    [...oceans, ...seas].sort((a, b) => geoArea(b) - geoArea(a)))
}

const builders = {
  'north-america': () => buildContinent(northAmerica),
  oceania: () => buildContinent(oceania),
  antarctica: buildAntarctica,
  oceans: buildOceans,
}
const selected = process.argv.slice(2)
for (const name of selected.length ? selected : Object.keys(builders)) {
  if (!builders[name]) throw new Error(`Unknown dataset: ${name}`)
  console.log(`${name}:`)
  await builders[name]()
}
