/**
 * Forenkler polygon-datasettene topologisk.
 *
 *   npm i --no-save topojson-server@3 topojson-simplify@3 topojson-client@3
 *   node scripts/simplify-geo.mjs [--check]
 *
 * Kjøres sjelden — resultatet er sjekket inn. Kjør på nytt bare når et
 * datasett blir byttet ut.
 *
 * Hvorfor: hvert punkt i et fylke er et punkt nettleseren må treffe-teste for
 * hver musbevegelse over kartet, og et punkt til å laste ned før noen kan
 * spille. Norge lå på 16 500 punkt — filigran som forsvinner under en piksel
 * selv helt innzoomet.
 *
 * Hvorfor topologi og ikke rett Douglas-Peucker per ring: to naboland deler
 * en grense. Forenkler du dem hver for seg, vandrer de to sidene av grensa i
 * hver sin retning, og det åpner seg sprekker av hav mellom dem. TopoJSON
 * gjør grensa til én bue som begge eier, så den blir forenklet én gang.
 *
 * `LEVELS` er andelen av punktene som overlever. 0.5 er valgt etter å ha
 * sammenlignet 0.7/0.5/0.35/0.25 side om side, både i helbilde og på 4× zoom
 * inn i Sognefjorden: 0.5 er ikke til å skille fra originalen, 0.35 runder
 * av fjordarmene, og 0.25 begynner å ete småøyene.
 *
 * Hva et datasett faktisk tåler, varierer likevel: Europa har Malta, som er
 * bygd av nettopp de småpunktene forenklinga eter først. Skriptet prøver derfor
 * fra hardest til mildest og tar det første nivået der alle features står
 * igjen innenfor arealbudsjettet.
 *
 * `--check` skriver bare hva som ville skjedd, og endrer ingen filer.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'
import { presimplify, simplify, quantile } from 'topojson-simplify'
import { feature } from 'topojson-client'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const check = process.argv.includes('--check')

/**
 * Filer nevnt på kommandolinja vinner over lista under.
 *
 * Forenklinga kan ikke kjøres to ganger på samme fila — andre runden eter av
 * det første runden lot stå. Når bare ett datasett er bygd på nytt, må
 * derfor bare det ene forenkles, og da er `node scripts/simplify-geo.mjs
 * src/data/europe/countries.json` det trygge kallet.
 */
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9]

/** Bare flatene. Punkt har ingenting å forenkle, og elvene er små alt. */
const FILES = [
  'src/data/norway/counties.json',
  'src/data/europe/countries.json',
  'src/data/asia/countries.json',
  'src/data/africa/countries.json',
  'src/data/usa/states.json',
  'src/data/world/countries.json',
]

/**
 * Terskel for hvor mye areal en feature får miste. Forenklinga fjerner
 * punkt etter hvor lite areal de bidrar med, og små øystater som Malta og
 * Kypros består av nettopp slike punkt — går de tapt, forsvinner et svar fra
 * spillet uten at noen oppdager det før en spiller klikker i tomt hav.
 */
const MAX_AREA_LOSS = 0.15

/**
 * Terskel for hvor mye av kystlinja en feature får miste.
 *
 * Areal alene er en blind målestokk for en kystlinje. En fjord er en tynn
 * revne — Sognefjorden er sytten mil lang og fire kilometer bred — så å stryke
 * den koster nesten ikke areal i det hele, men tar bort nettopp det som gjør
 * kysten til en norsk kyst. Forenklinga fjerner punkt etter hvor lite areal
 * de bidrar med, og går derfor rett i fjordene først.
 *
 * Omkretsen fanger det arealet ikke ser. En tjuendedel er satt med målestokk:
 * kartet blir tegnet 900 enheter høyt, så fem prosent av en norsk kystlinje er
 * fortsatt under en piksel per fjord. Ti prosent — det første forsøket — ga
 * et Europa med færre punkt enn det som alt lå i repoet.
 */
const MAX_EDGE_LOSS = 0.05

/**
 * Hvor liten en feature må være for å slippe forenkling helt, målt som
 * diagonalen i omslutningsboksen, i grader.
 *
 * `quantile` setter én vektterskel for hele topologien. En atoll-øy har små
 * trekanter over alt og ryker derfor først, samme hvor varsomt nivået er valgt:
 * Amerikansk Samoa mister halve arealet på nivået der Russland ennå er
 * urørt. Slike flater har ingen støy å fjerne — de *er* minstedetaljen — så
 * de blir holdt utenfor og lagt tilbake urørte etterpå.
 *
 * Én grad er rundt elleve mil. Alt under det er en øygruppe eller en
 * bystat, og veide uansett ingenting i filstørrelsen.
 */
const MIN_SIMPLIFY_SPAN = 1

const ringArea = (ring) => {
  let sum = 0
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return Math.abs(sum / 2)
}

function area(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polys.reduce((sum, poly) => sum + poly.reduce((s, ring) => s + ringArea(ring), 0), 0)
}

const ringLength = (ring) => {
  let sum = 0
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    sum += Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1])
  }
  return sum
}

/** Samlet kystlinje — alle ringer, i grader. Bare relative tall blir brukt. */
function perimeter(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polys.reduce((sum, poly) => sum + poly.reduce((s, ring) => s + ringLength(ring), 0), 0)
}

const count = (c) => (typeof c[0] === 'number' ? 1 : c.reduce((n, x) => n + count(x), 0))
const points = (fc) => fc.features.reduce((n, f) => n + count(f.geometry.coordinates), 0)

/**
 * Hvor lang en akseparallell kant får være før den blir delt opp, i grader.
 * Bulen vokser med kvadratet av lengden; to grader holder den under en
 * hundredels grad.
 */
const EDGE_STEP = 2

/**
 * Legg punkt tilbake langs lange, akseparallelle kantar.
 *
 * Noen kanter i datasettene er streker noen har trukket, ikke kystlinjer:
 * Russland er kuttet langs 58. breddegrad og 150. lengdegrad for å få plass i
 * Asia-kartet. Forenklinga fjerner nettopp slike punkt først — de ligger på
 * rekke og bidrar med null areal — og da står det igjen én kant fra 25°Ø til
 * 150°Ø. d3-geo tegner den kanten som en storsirkel, og buen mellom
 * endepunktene buler tretten breddegrader nordover: kartet zoomer ut til
 * Polhavet for et land som skulle stoppe ved Bajkal.
 *
 * En kant langs en meridian er derimot allerede en storsirkel, og trenger
 * ingenting. Bare de som ligger på en breddegrad blir delt.
 */
function densifyParallels(fc) {
  let added = 0
  const walk = (node) => {
    if (typeof node[0][0] !== 'number') return node.map(walk)
    const out = []
    for (let i = 0; i < node.length - 1; i++) {
      const a = node[i]
      const b = node[i + 1]
      out.push(a)
      const span = Math.abs(b[0] - a[0])
      if (a[1] !== b[1] || span <= EDGE_STEP) continue
      const steps = Math.ceil(span / EDGE_STEP)
      for (let s = 1; s < steps; s++) {
        out.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1]])
        added++
      }
    }
    out.push(node[node.length - 1])
    return out
  }

  for (const f of fc.features) {
    f.geometry = { ...f.geometry, coordinates: walk(f.geometry.coordinates) }
  }
  return added
}

/**
 * Den største enkeltringen i en feature, målt som diagonalen i
 * omslutningsboksen sin, i grader.
 *
 * Målet er per ring og ikke per feature med vilje. Fransk Polynesia spenner
 * over to tusen kilometer hav, men hver eneste øy er en prikk: hele
 * feature-en er minstedetalj, selv om boksen rundt den er stor. Det er
 * ringen, ikke spredningen, som sier om det finnes noe å forenkle.
 */
function span(geometry) {
  let largest = 0
  const walk = (node) => {
    if (typeof node[0][0] !== 'number') {
      node.forEach(walk)
      return
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of node) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    largest = Math.max(largest, Math.hypot(maxX - minX, maxY - minY))
  }
  walk(geometry.coordinates)
  return largest
}

let failed = false

/** Forenkler én gang på ett nivå, og sier fra hva som eventuelt røk. */
function attempt(src, keep) {
  // de minste flatene står over — se MIN_SIMPLIFY_SPAN
  const big = []
  const index = []
  src.features.forEach((f, i) => {
    if (span(f.geometry) >= MIN_SIMPLIFY_SPAN) {
      big.push(f)
      index.push(i)
    }
  })

  const topo = presimplify(topology({ layer: { type: 'FeatureCollection', features: big } }))
  const simplified = feature(simplify(topo, quantile(topo, keep)), 'layer')

  if (simplified.features.length !== big.length) {
    return { problem: `${big.length} → ${simplified.features.length} features` }
  }

  const out = { ...src, features: src.features.slice() }
  index.forEach((at, i) => {
    out.features[at] = simplified.features[i]
  })
  for (let i = 0; i < src.features.length; i++) {
    const name = src.features[i].properties?.name ?? src.features[i].properties?.id

    const beforeArea = area(src.features[i].geometry)
    const areaLoss = beforeArea === 0 ? 0 : 1 - area(out.features[i].geometry) / beforeArea
    if (areaLoss > MAX_AREA_LOSS) {
      return { problem: `«${name}» mista ${(areaLoss * 100).toFixed(0)} % av arealet` }
    }

    const beforeEdge = perimeter(src.features[i].geometry)
    const edgeLoss = beforeEdge === 0 ? 0 : 1 - perimeter(out.features[i].geometry) / beforeEdge
    if (edgeLoss > MAX_EDGE_LOSS) {
      return { problem: `«${name}» mista ${(edgeLoss * 100).toFixed(0)} % av kystlinja` }
    }
  }
  return { out }
}

for (const file of only.length ? only : FILES) {
  const path = resolve(root, file)
  const raw = readFileSync(path, 'utf8')
  const src = JSON.parse(raw)

  let chosen = null
  const rejected = []
  for (const keep of LEVELS) {
    const { out, problem } = attempt(src, keep)
    if (out) {
      chosen = { keep, out }
      break
    }
    rejected.push(`${keep}: ${problem}`)
  }

  if (!chosen) {
    console.error(`${file}: ingen nivå heldt mål —\n  ${rejected.join('\n  ')}`)
    failed = true
    continue
  }

  const restored = densifyParallels(chosen.out)
  const json = JSON.stringify(chosen.out)
  const note = rejected.length ? `  [${rejected.join('; ')}]` : ''
  const edges = restored ? `  +${restored} punkt langs klipte breiddegradar` : ''
  console.log(
    `${file.padEnd(32)} keep ${chosen.keep}  ` +
      `${(raw.length / 1024).toFixed(0)} → ${(json.length / 1024).toFixed(0)} kB  ` +
      `(${points(src)} → ${points(chosen.out)} punkt)${note}${edges}`,
  )
  if (!check) writeFileSync(path, json)
}

if (failed) process.exitCode = 1
else if (check) console.log('\n--check: ingen filer skrivne')
