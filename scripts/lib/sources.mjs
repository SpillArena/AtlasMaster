/**
 * Felles verktøy for datasett-byggarane.
 *
 * Geometrien kjem utanfrå — Natural Earth og world-atlas. Namna gjer han
 * ikkje: eit datasett veit ikkje at Tyrkia heiter Turkey på engelsk, og slett
 * ikkje at det heiter Tyrkia på norsk. Byggarane held difor si eiga
 * namneliste og hentar berre koordinatar herifrå.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '../..')
const CACHE = resolve(ROOT, 'node_modules/.cache/atlas-arena')

const NE_BASE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'

/**
 * Hentar eit Natural Earth-datasett, og legg det i node_modules/.cache slik at
 * neste køyring slepp nettet. Filene er 1–3 MB; dei har ingenting i repoet å
 * gjere når berre eit utdrag av dei blir sjekka inn.
 */
export async function naturalEarth(name) {
  const file = resolve(CACHE, `${name}.geojson`)
  if (!existsSync(file)) {
    process.stdout.write(`  henter ${name} …\n`)
    const res = await fetch(`${NE_BASE}/${name}.geojson`)
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
    mkdirSync(CACHE, { recursive: true })
    writeFileSync(file, await res.text())
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Les eit topojson-datasett frå ein npm-pakke installert med `--no-save`. */
export function fromNodeModules(path) {
  const file = resolve(ROOT, 'node_modules', path)
  if (!existsSync(file)) {
    throw new Error(
      `Fann ikkje ${path}. Køyr:\n` +
        '  npm i --no-save world-atlas@2 us-atlas@3 topojson-client@3',
    )
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Kuttar koordinatpresisjonen — 3 desimalar er ~100 m, meir enn nok her. */
export function round(value, decimals = 3) {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export function roundGeometry(geometry, decimals = 3) {
  const walk = (node) =>
    typeof node[0] === 'number'
      ? [round(node[0], decimals), round(node[1], decimals)]
      : node.map(walk)
  return { ...geometry, coordinates: walk(geometry.coordinates) }
}

/**
 * Fjernar punkt som avrundinga har gjort identiske.
 *
 * Å runde av til 2 desimalar er trygt sjølv om nabolanda deler grense: begge
 * sider snappar til det same rutenettet, så grensa held seg tett. Å tynne ut
 * punkt etter avstand er *ikkje* trygt her — då ville to naboland kasta kvar
 * sine punkt og etterlate ei sprekk mellom seg.
 */
export function dropRepeats(geometry) {
  const walk = (node) => {
    if (typeof node[0][0] !== 'number') {
      return node.map(walk).filter((n) => n && n.length > 0)
    }
    const kept = node.filter((c, i) => i === 0 || c[0] !== node[i - 1][0] || c[1] !== node[i - 1][1])
    // ein ring må framleis vere lukka og ha eit areal
    return kept.length < 4 ? null : kept
  }
  const coordinates = walk(geometry.coordinates)
  return coordinates.length > 0 ? { ...geometry, coordinates } : null
}

/** Fjernar punkt som ligg nærmare kvarandre enn oppløysinga vår ser. */
export function thinLine(coordinates, minStep = 0.01) {
  const kept = [coordinates[0]]
  for (const c of coordinates.slice(1, -1)) {
    const last = kept[kept.length - 1]
    if (Math.abs(c[0] - last[0]) + Math.abs(c[1] - last[1]) >= minStep) kept.push(c)
  }
  if (coordinates.length > 1) kept.push(coordinates[coordinates.length - 1])
  return kept
}

export const inBox = ([lon, lat], box) =>
  lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat

/** Midtpunktet i ein ring — brukt til å avgjere om ringen høyrer til regionen. */
export function ringCentre(ring) {
  let lon = 0
  let lat = 0
  for (const [x, y] of ring) {
    lon += x
    lat += y
  }
  return [lon / ring.length, lat / ring.length]
}

/**
 * Behald berre dei polygona som faktisk ligg i regionen.
 *
 * Land ber med seg øyer og oversjøiske område langt utanfor kontinentet sitt.
 * `fitExtent` bryr seg ikkje om at ei øy er liten — han zoomar ut til han får
 * henne med, og fastlandet krympar til ein flekk. Difor blir kvar ring vurdert
 * for seg, og dei som ligg utanfor blir kutta bort.
 */
export function clipPolygonToBox(geometry, box, extraTest = () => true) {
  const keep = (ring) => {
    const centre = ringCentre(ring)
    return inBox(centre, box) && extraTest(centre)
  }
  if (geometry.type === 'Polygon') {
    return keep(geometry.coordinates[0]) ? geometry : null
  }
  const kept = geometry.coordinates.filter((polygon) => keep(polygon[0]))
  if (kept.length === 0) return null
  return kept.length === 1
    ? { type: 'Polygon', coordinates: kept[0] }
    : { type: 'MultiPolygon', coordinates: kept }
}

/**
 * Klipper ei linje mot ei eller fleire boksar, og deler henne der ho går ut.
 *
 * Ei elv som Columbia startar i Canada. Tek vi berre bort punkta utanfor,
 * blir det att ein rett strek tvers over kartet mellom det siste punktet før
 * grensa og det første etter. Difor blir linja delt i staden.
 */
export function clipLineToBoxes(coordinates, boxes) {
  const parts = []
  let current = []
  for (const c of coordinates) {
    if (boxes.some((box) => inBox(c, box))) {
      current.push(c)
    } else if (current.length > 1) {
      parts.push(current)
      current = []
    } else {
      current = []
    }
  }
  if (current.length > 1) parts.push(current)
  return parts
}

/** Alle linjestrengane i ein feature, uansett om han er Line- eller MultiLineString. */
export function lineStrings(geometry) {
  return geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates]
}

/** Natural Earth har både dobbelt mellomrom og hermeteikn i namna sine. */
export const normaliseName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim()

export function writeCollection(outPath, features) {
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }))
  const kb = Math.round(readFileSync(outPath).length / 1024)
  console.log(`  ${features.length} features → ${outPath.replace(ROOT + '/', '')} (${kb} kB)`)
}

export { ROOT }
