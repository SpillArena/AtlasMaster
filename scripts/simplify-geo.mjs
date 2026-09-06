/**
 * Forenklar polygon-datasetta topologisk.
 *
 *   npm i --no-save topojson-server@3 topojson-simplify@3 topojson-client@3
 *   node scripts/simplify-geo.mjs [--check]
 *
 * Kjøres sjeldan — resultatet er sjekka inn. Køyr på nytt berre når eit
 * datasett blir bytt ut.
 *
 * Kvifor: kvart punkt i eit fylke er eit punkt nettlesaren må treffe-teste for
 * kvar musrørsle over kartet, og eit punkt til å laste ned før nokon kan
 * spele. Noreg låg på 16 500 punkt — filigran som forsvinn under ein piksel
 * sjølv heilt innzooma.
 *
 * Kvifor topologi og ikkje rett Douglas-Peucker per ring: to naboland deler
 * ei grense. Forenklar du dei kvar for seg, vandrar dei to sidene av grensa i
 * kvar si retning, og det opnar seg sprekker av hav mellom dei. TopoJSON
 * gjer grensa til éin boge som begge eig, så ho blir forenkla éin gong.
 *
 * `LEVELS` er delen av punkta som overlever. 0.5 er valt etter å ha
 * samanlikna 0.7/0.5/0.35/0.25 side om side, både i heilbilete og på 4× zoom
 * inn i Sognefjorden: 0.5 er ikkje til å skilje frå originalen, 0.35 rundar
 * av fjordarmane, og 0.25 byrjar å eta småøyane.
 *
 * Kva eit datasett faktisk toler, varierer likevel: Europa har Malta, som er
 * bygd av nettopp dei småpunkta forenklinga et først. Skriptet prøver difor
 * frå hardast til mildast og tek det første nivået der alle features står
 * att innanfor arealbudsjettet.
 *
 * `--check` skriv berre kva som ville skjedd, og endrar ingen filer.
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
 * Filer nemnde på kommandolinja vinn over lista under.
 *
 * Forenklinga kan ikkje køyrast to gonger på same fila — andre runden et av
 * det første runden lét stå. Når berre eitt datasett er bygd på nytt, må
 * difor berre det eine forenklast, og då er `node scripts/simplify-geo.mjs
 * src/data/europe/countries.json` det trygge kallet.
 */
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9]

/** Berre flatene. Punkt har ingenting å forenkle, og elvane er små alt. */
const FILES = [
  'src/data/norway/counties.json',
  'src/data/europe/countries.json',
  'src/data/asia/countries.json',
  'src/data/usa/states.json',
  'src/data/world/countries.json',
]

/**
 * Terskel for kor mykje areal ein feature får miste. Forenklinga fjernar
 * punkt etter kor lite areal dei bidreg med, og små øystatar som Malta og
 * Kypros består av nettopp slike punkt — går dei tapt, forsvinn eit svar frå
 * spelet utan at nokon oppdagar det før ein spelar klikkar i tomt hav.
 */
const MAX_AREA_LOSS = 0.15

/**
 * Terskel for kor mykje av kystlinja ein feature får miste.
 *
 * Areal åleine er ein blind målestokk for ei kystlinje. Ein fjord er ei tynn
 * revne — Sognefjorden er sytten mil lang og fire kilometer brei — så å stryke
 * han kostar nesten ikkje areal i det heile, men tek bort nettopp det som gjer
 * kysten til ein norsk kyst. Forenklinga fjernar punkt etter kor lite areal
 * dei bidreg med, og går difor rett i fjordane først.
 *
 * Omkrinsen fangar det arealet ikkje ser. Ein tjuandedel er sett med målestokk:
 * kartet blir teikna 900 einingar høgt, så fem prosent av ei norsk kystlinje er
 * framleis under ein piksel per fjord. Ti prosent — det første forsøket — gav
 * eit Europa med færre punkt enn det som alt låg i repoet.
 */
const MAX_EDGE_LOSS = 0.05

/**
 * Kor liten ein feature må vere for å sleppe forenkling heilt, målt som
 * diagonalen i omslutningsboksen, i grader.
 *
 * `quantile` set éin vektterskel for heile topologien. Ei atoll-øy har små
 * trekantar over alt og ryk difor først, same kor varsamt nivået er valt:
 * Amerikansk Samoa misser halve arealet på nivået der Russland enno er
 * urørt. Slike flater har inga støy å fjerne — dei *er* minstedetaljen — så
 * dei blir haldne utanfor og lagde tilbake urørte etterpå.
 *
 * Éin grad er rundt elleve mil. Alt under det er ei øygruppe eller ein
 * bystat, og vog uansett ingenting i filstorleiken.
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

/** Samla kystlinje — alle ringar, i grader. Berre relative tal blir brukte. */
function perimeter(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polys.reduce((sum, poly) => sum + poly.reduce((s, ring) => s + ringLength(ring), 0), 0)
}

const count = (c) => (typeof c[0] === 'number' ? 1 : c.reduce((n, x) => n + count(x), 0))
const points = (fc) => fc.features.reduce((n, f) => n + count(f.geometry.coordinates), 0)

/**
 * Kor lang ein akseparallell kant får vere før han blir delt opp, i grader.
 * Bulen veks med kvadratet av lengda; to grader held han under ein
 * hundredels grad.
 */
const EDGE_STEP = 2

/**
 * Legg punkt tilbake langs lange, akseparallelle kantar.
 *
 * Nokre kantar i datasetta er streker nokon har trekt, ikkje kystlinjer:
 * Russland er kutta langs 58. breiddegrad og 150. lengdegrad for å få plass i
 * Asia-kartet. Forenklinga fjernar nettopp slike punkt først — dei ligg på
 * rekkje og bidreg med null areal — og då står det att éin kant frå 25°Ø til
 * 150°Ø. d3-geo teiknar den kanten som ein storsirkel, og buen mellom
 * endepunkta bular tretten breiddegrader nordover: kartet zoomar ut til
 * Polhavet for eit land som skulle stoppe ved Bajkal.
 *
 * Ein kant langs ein meridian er derimot allereie ein storsirkel, og treng
 * ingenting. Berre dei som ligg på ein breiddegrad blir delte.
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
 * Den største einskildringen i ein feature, målt som diagonalen i
 * omslutningsboksen sin, i grader.
 *
 * Målet er per ring og ikkje per feature med vilje. Fransk Polynesia spenner
 * over to tusen kilometer hav, men kvar einaste øy er ein prikk: heile
 * feature-en er minstedetalj, sjølv om boksen rundt henne er stor. Det er
 * ringen, ikkje spreiinga, som seier om det finst noko å forenkle.
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

/** Forenklar éin gong på eitt nivå, og seier frå kva som eventuelt røk. */
function attempt(src, keep) {
  // dei minste flatene står over — sjå MIN_SIMPLIFY_SPAN
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
