/**
 * Genererer verdenskartet: src/data/world/countries.json og flagg-settet under
 * src/data/world/flags/.
 *
 * Kjøres sjelden — resultatet er sjekket inn. Kjør på nytt bare når landlista,
 * oppløsningen eller flaggene skal endres:
 *
 *   npm i --no-save world-atlas@2 topojson-client@3 world-countries@5 flag-icons@7 svgo@3
 *   node scripts/build-world.mjs
 *
 * HVORFOR FLAGG SOM FILER. Resten av spillet tegner flaggene selv fra en
 * geometrisk beskrivelse (game/flags.ts) — det holder for Europa, der de
 * fleste flagg *er* to-tre bånd. Hele verden er ikke det: våpenskjold,
 * seglmerker og silhuetter kan ikke beskrives i noen få tall. Verdensregionen
 * får derfor et ekte flaggsett, og det er eneste stedet i prosjektet med
 * bilde-flagg. Filene kommer fra `flag-icons` (MIT) og kopieres inn her, ikke
 * hentet fra en fremmed tjener mens noen spiller.
 *
 * HVA SOM ER MED. Alle land i world-atlas 110m som har en ISO 3166-1-kode og
 * et flagg i settet. Antarktis og områder uten egen kode (Nord-Kypros,
 * Somaliland) er utelatt. Kosovo er med under «XK».
 */

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import { optimize } from 'svgo'
import { dropRepeats, roundGeometry } from './lib/sources.mjs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const OUT_DIR = resolve(ROOT, 'src/data/world')
const OUT_JSON = resolve(OUT_DIR, 'countries.json')
const FLAG_DIR = resolve(OUT_DIR, 'flags')
const FLAG_SRC = resolve(ROOT, 'node_modules/flag-icons/flags/4x3')

const HINT = 'npm i --no-save world-atlas@2 topojson-client@3 world-countries@5 flag-icons@7 svgo@3'
for (const path of ['world-atlas/countries-110m.json', 'world-countries', 'flag-icons/flags/4x3', 'svgo']) {
  if (!existsSync(resolve(ROOT, 'node_modules', path))) {
    throw new Error(`Fant ikke ${path}. Kjør:\n  ${HINT}`)
  }
}

const topology = JSON.parse(
  readFileSync(resolve(ROOT, 'node_modules/world-atlas/countries-110m.json'), 'utf8'),
)
const world = feature(topology, topology.objects.countries)
const countries = require('world-countries')

/** ccn3 → ISO 3166-1 alpha-2 (små bokstaver), pluss engelsk kortnavn. */
const byCcn3 = new Map()
for (const c of countries) {
  if (c.ccn3) byCcn3.set(c.ccn3, { iso2: c.cca2.toLowerCase(), en: c.name.common })
}
// Kosovo har ingen offisiell numerisk kode; world-atlas gir feature-en ingen id.
const KOSOVO = { id: 'XK', iso2: 'xk', name: 'Kosovo', nameEn: 'Kosovo' }

const noName = new Intl.DisplayNames(['nb'], { type: 'region' })
const enName = new Intl.DisplayNames(['en'], { type: 'region' })

/**
 * Utelatt:
 * - 010 Antarktis: fyller en tredjedel av kartet og har ingen å gjette.
 * - 242 Fiji: øygruppa ligger på begge sider av datolinja. I world-atlas 110m
 *   blir ytterringen viklet feil vei, og d3-geo tegner den da som resten av
 *   kloden — hele verdenskartet blir et ensfarget rektangel. Å klippe den rent
 *   hører til en senere runde; ett lite land er ikke verdt et ødelagt kart.
 */
const EXCLUDE = new Set(['010', '242'])

const features = []
const missingFlag = []

for (const f of world.features) {
  const id = f.id == null ? null : String(f.id)

  let entry
  if (id === null && f.properties?.name === 'Kosovo') {
    entry = KOSOVO
  } else if (id && !EXCLUDE.has(id) && byCcn3.has(id)) {
    const { iso2, en } = byCcn3.get(id)
    entry = {
      id,
      iso2,
      name: noName.of(iso2.toUpperCase()) || en,
      nameEn: enName.of(iso2.toUpperCase()) || en,
    }
  } else {
    continue
  }

  if (!existsSync(resolve(FLAG_SRC, `${entry.iso2}.svg`))) {
    missingFlag.push(`${entry.name} (${entry.iso2})`)
    continue
  }

  const geometry = dropRepeats(roundGeometry(f.geometry, 2))
  if (!geometry) continue

  features.push({
    type: 'Feature',
    properties: { id: entry.id, name: entry.name, nameEn: entry.nameEn, iso2: entry.iso2 },
    geometry,
  })
}

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))

// MERK — ingen `rewind` her, i motsetning til de andre region-byggerne.
// world-atlas leverer allerede ringene med den vinklingen d3-geo forventer,
// og `@mapbox/geojson-rewind` ødelegger polygoner som krysser datolinja:
// Russland blir tegnet som resten av kloden. De andre regionene slipper unna
// fordi de klipper Russland til en boks først; verdenskartet må vise landet
// helt. scripts/check-geo.mjs vokter at ringene faktisk er riktige.
const collection = { type: 'FeatureCollection', features }

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_JSON, JSON.stringify(collection))

// flaggsettet: bare de landene som faktisk er med, kjørt gjennom svgo. Noen
// flagg bærer et fullt våpenskjold og er 40–180 kB rå; svgo halverer settet.
rmSync(FLAG_DIR, { recursive: true, force: true })
mkdirSync(FLAG_DIR, { recursive: true })
const iso2map = {}
let rawBytes = 0
let optBytes = 0
for (const feat of features) {
  const { id, iso2 } = feat.properties
  const src = resolve(FLAG_SRC, `${iso2}.svg`)
  const raw = readFileSync(src, 'utf8')
  const { data } = optimize(raw, { path: src, multipass: true })
  writeFileSync(resolve(FLAG_DIR, `${iso2}.svg`), data)
  rawBytes += raw.length
  optBytes += data.length
  iso2map[id] = iso2
}
writeFileSync(resolve(OUT_DIR, 'flags.json'), JSON.stringify(iso2map))

const kb = Math.round(Buffer.byteLength(JSON.stringify(collection)) / 1024)
console.log(`Skrev ${features.length} land til ${OUT_JSON.replace(ROOT + '/', '')} (${kb} kB)`)
const flagKb = Math.round(readdirSync(FLAG_DIR).reduce((n, f) => n + statSync(resolve(FLAG_DIR, f)).size, 0) / 1024)
console.log(
  `Optimerte ${readdirSync(FLAG_DIR).length} flagg til ${FLAG_DIR.replace(ROOT + '/', '')} ` +
    `(${flagKb} kB, ${Math.round((1 - optBytes / rawBytes) * 100)} % mindre enn rått)`,
)
if (missingFlag.length) console.warn(`Uten flagg i settet, hoppet over: ${missingFlag.join(', ')}`)
