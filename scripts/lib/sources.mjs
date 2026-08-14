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
const CACHE = resolve(ROOT, 'node_modules/.cache/atlasmaster')

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
 * Rullar ut lengdegradane så ringen blir samanhengande over datolinja.
 *
 * Russland sin ytterring går austover frå 20°Ø heilt til Tsjuktsjarhalvøya,
 * og der skiftar koordinatane brått frå 179 til −179. For ein klippealgoritme
 * som reknar rett fram i lengd/breidd er det eit sprang tvers over heile
 * kloden, og han lagar skjeringspunkt langs ein kant som ikkje finst. Ved å
 * legge til ±360 der spranget skjer, blir Tsjuktsjarhalvøya liggjande på
 * 180–190 i staden, langt utanfor kvar einaste europeisk eller asiatisk boks,
 * og fell reint bort i klippinga.
 */
function unwrapRing(ring) {
  const out = [[...ring[0]]]
  for (let i = 1; i < ring.length; i++) {
    const prevLon = out[i - 1][0]
    let lon = ring[i][0]
    while (lon - prevLon > 180) lon -= 360
    while (lon - prevLon < -180) lon += 360
    out.push([lon, ring[i][1]])
  }
  return out
}

/**
 * Deler opp dei lange strekka klippinga sjølv har laga.
 *
 * d3-geo teiknar kvar kant i eit polygon som ein storsirkel. Ei rett linje
 * langs 72. breiddegrad frå 26°Ø til 46°Ø er ikkje ein storsirkel — buen
 * mellom endepunkta bular nesten tre grader lenger nord, og då dreg kartet
 * med seg tre grader ekstra utsnitt som ingen skal sjå.
 *
 * Berre kantar som ligg *på* boksen blir delte. Ei lang, rett landegrense i
 * kjeldedataa er ei ekte geodetisk linje og skal teiknast som ein storsirkel;
 * å tette henne med punkt ville berre gjort fila større. Bulen veks med
 * kvadratet av lengda, så tre grader mellom punkta held han under ein
 * tidels tusendel av utsnittet.
 */
function densifyBoxEdges(ring, box, maxStep) {
  const onEdge = ([lon, lat]) =>
    lon === box.minLon || lon === box.maxLon || lat === box.minLat || lat === box.maxLat
  const out = []
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]
    const b = ring[i + 1]
    out.push(a)
    if (!onEdge(a) || !onEdge(b)) continue
    const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / maxStep)
    for (let s = 1; s < steps; s++) {
      out.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps])
    }
  }
  out.push(ring[ring.length - 1])
  return out
}

/**
 * Klipper éin ring mot ein boks — Sutherland–Hodgman, ei halvflate om gongen.
 *
 * Returnerer null om ringen ligg heilt utanfor. Orienteringa til ringen
 * overlever klippinga: algoritmen går gjennom punkta i same rekkjefølgje og
 * legg berre til skjeringspunkt der kanten kryssar.
 */
function clipRing(ring, box) {
  const crossX = (a, b, x) => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])]
  const crossY = (a, b, y) => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y]
  const edges = [
    { inside: (p) => p[0] >= box.minLon, cut: (a, b) => crossX(a, b, box.minLon) },
    { inside: (p) => p[0] <= box.maxLon, cut: (a, b) => crossX(a, b, box.maxLon) },
    { inside: (p) => p[1] >= box.minLat, cut: (a, b) => crossY(a, b, box.minLat) },
    { inside: (p) => p[1] <= box.maxLat, cut: (a, b) => crossY(a, b, box.maxLat) },
  ]

  // ringen blir opna medan vi jobbar, og lukka att til slutt
  let out = ring.slice(0, -1)
  for (const edge of edges) {
    const input = out
    out = []
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]
      const prev = input[(i + input.length - 1) % input.length]
      const curIn = edge.inside(cur)
      const prevIn = edge.inside(prev)
      if (curIn) {
        if (!prevIn) out.push(edge.cut(prev, cur))
        out.push(cur)
      } else if (prevIn) {
        out.push(edge.cut(prev, cur))
      }
    }
    if (out.length === 0) return null
  }
  return out.length >= 3 ? [...out, [...out[0]]] : null
}

/**
 * Klipper eit polygon mot ein boks — geometrisk, ikkje ring for ring.
 *
 * `clipPolygonToBox` over avgjer per ring: heile Sibir er inne eller heilt
 * ute. Det held for øyer og oversjøiske område, men ikkje for eit land som
 * ligg i to regionar. Russland høyrer heime i både Europa og Asia, og må
 * difor kunne kuttast tvers gjennom.
 *
 * Å kutte i staden for å utelate er òg det som held datolinja unna: den
 * russiske ytterringen strekk seg forbi 180°, og eit polygon som kryssar
 * antimeridianen blir eit smett tvers over kartet i ei kvar projeksjon.
 * Boksen stoppar geometrien lenge før ho kjem dit.
 */
export function clipGeometryToBox(geometry, box, maxStep = 3) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const cut = (ring) => {
    const clipped = clipRing(unwrapRing(ring), box)
    return clipped && densifyBoxEdges(clipped, box, maxStep)
  }
  const kept = []
  for (const polygon of polygons) {
    // ytterringen først: forsvinn han, har hola inga flate å ligge i
    const outer = cut(polygon[0])
    if (!outer) continue
    const rings = [outer]
    for (const hole of polygon.slice(1)) {
      const clipped = cut(hole)
      if (clipped) rings.push(clipped)
    }
    kept.push(rings)
  }
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
