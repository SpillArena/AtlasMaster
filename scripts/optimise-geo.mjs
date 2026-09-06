/**
 * Trimmer koordinatpresisjonen i de innsjekkede GeoJSON-datasettene.
 *
 *   node scripts/optimise-geo.mjs [--check]
 *
 * Kilder som Natural Earth og SSB leverer koordinater med opp til 16
 * desimaler. Det er flyttall-støy, ikke presisjon: sekstende desimalen av en
 * lengdegrad er under en milliardtedels meter. Norges fylke lå på 624 kB
 * av den grunnen alene — samme fila som må lastes ned før noen kan spille,
 * og samme punktmengden nettleseren må treffe-teste for hver musbevegelse.
 *
 * Vi skriver tre desimaler ≈ 110 m. Lerretet er 900 enheter høyt og zoomer
 * maksimalt åtte ganger; for Norge, som er ~1800 km høyt, blir det rundt 250 m
 * per piksel på det nærmeste. En feil på 110 m er da under en halv piksel —
 * usynlig, selv helt innzoomet.
 *
 * MERK — avrundingen er topologitrygg. To fylke som deler en grense har
 * identiske koordinater på begge sider fra før, og identiske tall runder likt.
 * Grensa blir derfor værende delt, uten sprekker mellom naboer.
 *
 * `--check` skriver bare hva som ville skjedd, og endrer ingen filer.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { globSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const check = process.argv.includes('--check')

/** Desimaler på lengde/bredde. Tre ≈ 110 m; se kommentaren over. */
const DECIMALS = 3
const factor = 10 ** DECIMALS

const round = (n) => Math.round(n * factor) / factor

/**
 * Runder av, og fjerner punkt som faller sammen etter avrundingen. En ring må
 * fortsatt være lukket og ha minst fire punkt, ellers blir den værende urørt —
 * en trekant med sammenfallende hjørner er ikke et polygon lenger.
 */
function thin(coords) {
  if (typeof coords[0] === 'number') return [round(coords[0]), round(coords[1])]

  const out = coords.map(thin)
  if (typeof coords[0][0] !== 'number') return out

  const dedup = out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1])
  const closed = out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]
  if (closed) {
    if (dedup.length < 4) return out
    // siste punkt må fortsatt være det første
    const last = dedup[dedup.length - 1]
    if (last[0] !== dedup[0][0] || last[1] !== dedup[0][1]) dedup.push([...dedup[0]])
    return dedup
  }
  return dedup.length >= 2 ? dedup : out
}

const count = (coords) => (typeof coords[0] === 'number' ? 1 : coords.reduce((n, c) => n + count(c), 0))

let totalBefore = 0
let totalAfter = 0

for (const file of globSync('src/data/*/*.json', { cwd: root }).sort()) {
  const path = resolve(root, file)
  const raw = readFileSync(path, 'utf8')
  const data = JSON.parse(raw)

  // src/data/*/ rommar meir enn geometri: world/flags.json er ei id→landkode-
  // tabell. Globben tek henne med, og utan denne linja stoppar heile
  // rørledninga på ei fil som aldri hadde koordinatar å runde av.
  if (!Array.isArray(data.features)) continue

  let before = 0
  let after = 0
  for (const f of data.features) {
    before += count(f.geometry.coordinates)
    f.geometry.coordinates = thin(f.geometry.coordinates)
    after += count(f.geometry.coordinates)
  }

  const out = JSON.stringify(data)
  totalBefore += raw.length
  totalAfter += out.length

  const kb = (n) => `${(n / 1024).toFixed(0)} kB`
  const saved = raw.length - out.length
  if (saved > 0) {
    console.log(
      `${relative(root, path).padEnd(32)} ${kb(raw.length)} → ${kb(out.length)}` +
        `  (${before} → ${after} punkt)`,
    )
    if (!check) writeFileSync(path, out)
  }
}

console.log(
  `\ntotalt ${(totalBefore / 1024).toFixed(0)} kB → ${(totalAfter / 1024).toFixed(0)} kB` +
    (check ? '  (--check: ingen filer skrivne)' : ''),
)
