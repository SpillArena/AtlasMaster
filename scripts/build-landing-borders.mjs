/**
 * Genererer src/data/landing/borders.json: de indre grensene (delstater,
 * provinser) som landingssiden tegner oppå de store landene i Nord-Amerika.
 *
 *   npm i --no-save us-atlas@3 topojson-client@3
 *   node scripts/build-landing-borders.mjs
 *
 * Resultatet er sjekket inn. Kjør på nytt bare når lista over land endres.
 *
 * HVORFOR. Verdenskartet har én flate per land, og i de fleste verdensdeler er
 * det nok — landene er små nok til at landegrensene selv gir kartet et mønster.
 * USA, Canada og Mexico er ikke det: de leste som tre store, tomme flater midt
 * i et ellers rutete kart. Her kommer bare linjene *mellom* statene, aldri
 * kyst eller riksgrense — de tegner verdenskartet allerede, og en grense
 * tegnet to ganger fra to kilder blir en dobbel strek.
 *
 * TO KILDER, MED VILJE.
 * - USA fra us-atlas. `mesh` med `a !== b` gir hver indre grense nøyaktig én
 *   gang. Natural Earth sine USA-linjer har i tillegg «statistiske» grenser
 *   midt i De store sjøene, som på et kart der sjøene er land ser ut som
 *   tilfeldige streker.
 * - Canada og Mexico fra Natural Earth 10m, bare klassen «Admin-1 boundary».
 *   De statistiske klassene deler opp havet nord for Nunavut, ikke land.
 *
 * Utdataene er én feature per land, med landets M49-kode som id, så kartet kan
 * legge linjene i samme regiongruppe som landet de hører til.
 */

import { resolve } from 'node:path'
import { mesh } from 'topojson-client'
import { ROOT, fromNodeModules, naturalEarth, roundGeometry, writeCollection } from './lib/sources.mjs'

const OUT = resolve(ROOT, 'src/data/landing/borders.json')

/**
 * Hvor langt en forenklet linje kan avvike fra originalen, i grader.
 *
 * Landingskartet er hele kloden på høyst 1760 piksler, altså rundt 0,2 grader
 * per piksel. 0,02 er en tidel av en piksel — ingen ser forskjellen — og tar
 * Mexico fra 7600 punkt til en brøkdel. Delstatsgrensene der følger elver og
 * fjellrygger i 10m-oppløsning, og det meste av taggene er støy på denne
 * målestokken.
 *
 * Douglas–Peucker og ikke `thinLine`: den siste holder en minsteavstand
 * mellom punktene, og en linje som tagger seg fram i små, jevne steg slipper
 * gjennom nesten urørt. Douglas–Peucker måler avviket fra formen.
 */
const TOLERANCE = 0.02

function simplify(line) {
  if (line.length < 3) return line
  const keep = new Uint8Array(line.length)
  keep[0] = keep[line.length - 1] = 1
  const stack = [[0, line.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = line[a]
    const [bx, by] = line[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    let far = -1
    let worst = TOLERANCE
    for (let i = a + 1; i < b; i++) {
      const [px, py] = line[i]
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len
      if (d > worst) {
        worst = d
        far = i
      }
    }
    if (far >= 0) {
      keep[far] = 1
      stack.push([a, far], [far, b])
    }
  }
  return line.filter((_, i) => keep[i])
}

/** ADM0_A3 i Natural Earth → M49 i verdenskartet. */
const NE_COUNTRIES = [
  ['CAN', '124'],
  ['MEX', '484'],
]

const dedupe = (line) => line.filter((c, i) => i === 0 || c[0] !== line[i - 1][0] || c[1] !== line[i - 1][1])

/*
 * Ikke `dropRepeats` fra sources.mjs: den er skrevet for ringer og kaster alt
 * under fire punkt — og de fleste grensene vest for Mississippi er én rett
 * strek mellom to.
 */
function clean(lines) {
  const coordinates = join(lines)
    .map((line) => dedupe(roundGeometry({ type: 'LineString', coordinates: simplify(line) }, 2).coordinates))
    .filter((line) => line.length >= 2)
  return { type: 'MultiLineString', coordinates }
}

/**
 * Skjøter linjebiter som møtes i et endepunkt.
 *
 * Natural Earth leverer Mexico som 630 korte biter, én per grenseavsnitt.
 * Hver bit beholder begge endepunktene sine gjennom tynningen, så uskjøtt ble
 * de korteste bitene stående med alle punktene de hadde — og hvert skjøt ble
 * tegnet som to linjeender oppå hverandre.
 */
function join(lines) {
  const key = ([x, y]) => `${x},${y}`
  const pool = lines.map((l) => l.slice())
  const byEnd = new Map()
  const index = (line) => {
    for (const end of [line[0], line[line.length - 1]]) {
      const k = key(end)
      if (!byEnd.has(k)) byEnd.set(k, new Set())
      byEnd.get(k).add(line)
    }
  }
  const unindex = (line) => {
    for (const end of [line[0], line[line.length - 1]]) byEnd.get(key(end))?.delete(line)
  }
  pool.forEach(index)
  const out = []
  const used = new Set()
  for (const start of pool) {
    if (used.has(start)) continue
    used.add(start)
    unindex(start)
    let line = start
    for (const forward of [true, false]) {
      for (;;) {
        const end = forward ? line[line.length - 1] : line[0]
        const next = [...(byEnd.get(key(end)) ?? [])].find((l) => !used.has(l))
        if (!next) break
        used.add(next)
        unindex(next)
        const oriented = key(next[0]) === key(end) ? next : next.slice().reverse()
        line = forward ? line.concat(oriented.slice(1)) : oriented.slice(0, -1).concat(line)
        // en ring er ferdig
        if (key(line[0]) === key(line[line.length - 1])) break
      }
    }
    out.push(line)
  }
  return out
}

const points = (geometry) => geometry.coordinates.reduce((n, line) => n + line.length, 0)

const features = []

const topology = fromNodeModules('us-atlas/states-10m.json')
const usa = mesh(topology, topology.objects.states, (a, b) => a !== b)
features.push({ type: 'Feature', properties: { id: '840' }, geometry: clean(usa.coordinates) })

const ne = await naturalEarth('ne_10m_admin_1_states_provinces_lines')
for (const [a3, id] of NE_COUNTRIES) {
  const lines = []
  for (const f of ne.features) {
    if (f.properties.ADM0_A3 !== a3 || f.properties.FEATURECLA !== 'Admin-1 boundary') continue
    const g = f.geometry
    if (g.type === 'LineString') lines.push(g.coordinates)
    else if (g.type === 'MultiLineString') lines.push(...g.coordinates)
  }
  features.push({ type: 'Feature', properties: { id }, geometry: clean(lines) })
}

for (const f of features) console.log(`  ${f.properties.id}: ${f.geometry.coordinates.length} linjer, ${points(f.geometry)} punkt`)
writeCollection(OUT, features)
