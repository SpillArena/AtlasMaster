/**
 * Felles verktøy for datasett-byggerne.
 *
 * Geometrien kommer utenfra — Natural Earth og world-atlas. Navnene gjør den
 * ikke: et datasett vet ikke at Tyrkia heter Turkey på engelsk, og slett
 * ikke at det heter Tyrkia på norsk. Byggerne holder derfor sin egen
 * navneliste og henter bare koordinater herfra.
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
 * Henter et Natural Earth-datasett, og legger det i node_modules/.cache slik at
 * neste kjøring slipper nettet. Filene er 1–3 MB; de har ingenting i repoet å
 * gjøre når bare et utdrag av dem blir sjekket inn.
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

/**
 * Samme mønsteret som `naturalEarth` over, for byggere som henter fra en
 * annen kilde enn Natural Earth og derfor trenger en egen URL og et eget
 * filnavn i cachen.
 */
export async function fetchCached(url, filename) {
  const file = resolve(CACHE, filename)
  if (!existsSync(file)) {
    process.stdout.write(`  henter ${filename} …\n`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${filename}: HTTP ${res.status}`)
    mkdirSync(CACHE, { recursive: true })
    writeFileSync(file, await res.text())
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Leser et topojson-datasett fra en npm-pakke installert med `--no-save`. */
export function fromNodeModules(path) {
  const file = resolve(ROOT, 'node_modules', path)
  if (!existsSync(file)) {
    throw new Error(
      `Fant ikke ${path}. Kjør:\n` +
        '  npm i --no-save world-atlas@2 us-atlas@3 topojson-client@3',
    )
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Kutter koordinatpresisjonen — 3 desimaler er ~100 m, mer enn nok her. */
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
 * Fjerner punkt som avrundingen har gjort identiske.
 *
 * Å runde av til 2 desimaler er trygt selv om nabolandene deler grense: begge
 * sider snapper til det samme rutenettet, så grensa holder seg tett. Å tynne ut
 * punkt etter avstand er *ikke* trygt her — da ville to naboland kastet hver
 * sine punkt og etterlatt en sprekk mellom seg.
 */
export function dropRepeats(geometry) {
  const walk = (node) => {
    if (typeof node[0][0] !== 'number') {
      return node.map(walk).filter((n) => n && n.length > 0)
    }
    const kept = node.filter((c, i) => i === 0 || c[0] !== node[i - 1][0] || c[1] !== node[i - 1][1])
    // en ring må fortsatt være lukket og ha et areal
    return kept.length < 4 ? null : kept
  }
  const coordinates = walk(geometry.coordinates)
  return coordinates.length > 0 ? { ...geometry, coordinates } : null
}

/** Fjerner punkt som ligger nærmere hverandre enn oppløsningen vår ser. */
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

/** Midtpunktet i en ring — brukt til å avgjøre om ringen hører til regionen. */
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
 * Behold bare de polygonene som faktisk ligger i regionen.
 *
 * Land bærer med seg øyer og oversjøiske område langt utenfor kontinentet sitt.
 * `fitExtent` bryr seg ikke om at en øy er liten — den zoomer ut til den får
 * den med, og fastlandet krymper til en flekk. Derfor blir hver ring vurdert
 * for seg, og de som ligger utenfor blir kuttet bort.
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
 * Ruller ut lengdegradene så ringen blir sammenhengende over datolinja.
 *
 * Russlands ytterring går østover fra 20°Ø helt til Tsjuktsjarhalvøya,
 * og der skifter koordinatene brått fra 179 til −179. For en klippealgoritme
 * som regner rett fram i lengde/bredde er det et sprang tvers over hele
 * kloden, og den lager skjeringspunkt langs en kant som ikke finnes. Ved å
 * legge til ±360 der spranget skjer, blir Tsjuktsjarhalvøya liggende på
 * 180–190 i stedet, langt utenfor hver eneste europeisk eller asiatisk boks,
 * og faller rent bort i klippinga.
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
 * Deler opp de lange strekkene klippinga selv har laget.
 *
 * d3-geo tegner hver kant i et polygon som en storsirkel. En rett linje
 * langs 72. breddegrad fra 26°Ø til 46°Ø er ikke en storsirkel — buen
 * mellom endepunktene buler nesten tre grader lenger nord, og da drar kartet
 * med seg tre grader ekstra utsnitt som ingen skal se.
 *
 * Bare kanter som ligger *på* boksen blir delt. En lang, rett landegrense i
 * kildedataene er en ekte geodetisk linje og skal tegnes som en storsirkel;
 * å tette den med punkt ville bare gjort fila større. Bulen vokser med
 * kvadratet av lengden, så tre grader mellom punktene holder den under en
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
 * Klipper én ring mot en boks — Sutherland–Hodgman, én halvflate om gangen.
 *
 * Returnerer null om ringen ligger helt utenfor. Orienteringen til ringen
 * overlever klippingen: algoritmen går gjennom punktene i samme rekkefølge og
 * legger bare til skjæringspunkt der kanten krysser.
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

  // ringen blir åpnet mens vi jobber, og lukket igjen til slutt
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
 * Klipper et polygon mot en boks — geometrisk, ikke ring for ring.
 *
 * `clipPolygonToBox` over avgjør per ring: hele Sibir er inne eller helt
 * ute. Det holder for øyer og oversjøiske områder, men ikke for et land som
 * ligger i to regioner. Russland hører hjemme i både Europa og Asia, og må
 * derfor kunne kuttes tvers gjennom.
 *
 * Å kutte i stedet for å utelate er også det som holder datolinja unna: den
 * russiske ytterringen strekker seg forbi 180°, og et polygon som krysser
 * antimeridianen blir et smett tvers over kartet i enhver projeksjon.
 * Boksen stopper geometrien lenge før den kommer dit.
 */
export function clipGeometryToBox(geometry, box, maxStep = 3) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const cut = (ring) => {
    const clipped = clipRing(unwrapRing(ring), box)
    return clipped && densifyBoxEdges(clipped, box, maxStep)
  }
  const kept = []
  for (const polygon of polygons) {
    // ytterringen først: forsvinner den, har hullene ingen flate å ligge i
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
 * Klipper en linje mot en eller flere bokser, og deler den der den går ut.
 *
 * En elv som Columbia starter i Canada. Tar vi bare bort punktene utenfor,
 * blir det igjen en rett strek tvers over kartet mellom det siste punktet før
 * grensa og det første etter. Derfor blir linja delt i stedet.
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

/** Alle linjestrengene i en feature, uansett om den er Line- eller MultiLineString. */
export function lineStrings(geometry) {
  return geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates]
}

/** Natural Earth har både dobbelt mellomrom og hermetegn i navnene sine. */
export const normaliseName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim()

export function writeCollection(outPath, features) {
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }))
  const kb = Math.round(readFileSync(outPath).length / 1024)
  console.log(`  ${features.length} features → ${outPath.replace(ROOT + '/', '')} (${kb} kB)`)
}

export { ROOT }
