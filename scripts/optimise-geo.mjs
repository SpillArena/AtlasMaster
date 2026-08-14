/**
 * Trimmar koordinatpresisjonen i dei innsjekka GeoJSON-datasetta.
 *
 *   node scripts/optimise-geo.mjs [--check]
 *
 * Kjelder som Natural Earth og SSB leverer koordinatar med opp til 16
 * desimalar. Det er flyttal-støy, ikkje presisjon: sekstande desimalen av ein
 * lengdegrad er under ein milliardtedels meter. Noreg sine fylke låg på 624 kB
 * av den grunnen åleine — same fila som må lastast ned før nokon kan spele,
 * og same punktmengda nettlesaren må treffe-teste for kvar musrørsle.
 *
 * Vi skriv tre desimalar ≈ 110 m. Lerretet er 900 einingar høgt og zoomar
 * maksimalt åtte gonger; for Noreg, som er ~1800 km høgt, blir det rundt 250 m
 * per piksel på det næraste. Ein feil på 110 m er då under ein halv piksel —
 * usynleg, sjølv heilt innzooma.
 *
 * MERK — avrundinga er topologitrygg. To fylke som deler ei grense har
 * identiske koordinatar på begge sider frå før, og identiske tal rundar likt.
 * Grensa blir difor verande delt, utan sprekker mellom naboar.
 *
 * `--check` skriv berre kva som ville skjedd, og endrar ingen filer.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { globSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const check = process.argv.includes('--check')

/** Desimalar på lengd/breidd. Tre ≈ 110 m; sjå kommentaren over. */
const DECIMALS = 3
const factor = 10 ** DECIMALS

const round = (n) => Math.round(n * factor) / factor

/**
 * Rundar av, og fjernar punkt som fell saman etter avrundinga. Ein ring må
 * framleis vere lukka og ha minst fire punkt, elles blir han verande urørt —
 * ein trekant med samanfallande hjørne er ikkje eit polygon lenger.
 */
function thin(coords) {
  if (typeof coords[0] === 'number') return [round(coords[0]), round(coords[1])]

  const out = coords.map(thin)
  if (typeof coords[0][0] !== 'number') return out

  const dedup = out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1])
  const closed = out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]
  if (closed) {
    if (dedup.length < 4) return out
    // siste punkt må framleis vere det første
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
