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

const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9]

/** Berre flatene. Punkt har ingenting å forenkle, og elvane er små alt. */
const FILES = [
  'src/data/norway/counties.json',
  'src/data/europe/countries.json',
  'src/data/asia/countries.json',
  'src/data/usa/states.json',
]

/**
 * Terskel for kor mykje areal ein feature får miste. Forenklinga fjernar
 * punkt etter kor lite areal dei bidreg med, og små øystatar som Malta og
 * Kypros består av nettopp slike punkt — går dei tapt, forsvinn eit svar frå
 * spelet utan at nokon oppdagar det før ein spelar klikkar i tomt hav.
 */
const MAX_AREA_LOSS = 0.15

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

let failed = false

/** Forenklar éin gong på eitt nivå, og seier frå kva som eventuelt røk. */
function attempt(src, keep) {
  const topo = presimplify(topology({ layer: src }))
  const out = feature(simplify(topo, quantile(topo, keep)), 'layer')

  if (out.features.length !== src.features.length) {
    return { problem: `${src.features.length} → ${out.features.length} features` }
  }
  for (let i = 0; i < src.features.length; i++) {
    const before = area(src.features[i].geometry)
    const after = area(out.features[i].geometry)
    const loss = before === 0 ? 0 : 1 - after / before
    if (loss > MAX_AREA_LOSS) {
      const name = src.features[i].properties?.name ?? src.features[i].properties?.id
      return { problem: `«${name}» mista ${(loss * 100).toFixed(0)} % av arealet` }
    }
  }
  return { out }
}

for (const file of FILES) {
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
