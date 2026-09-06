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
 * HVA SOM ER MED. Alle flater i world-atlas 50m, men ikke alle er svar.
 *
 * 110m — det kartet dette var bygd på før — har ganske enkelt ikke Malta.
 * Heller ikke Monaco, Singapore, San Marino, Liechtenstein, Andorra, Bahrain,
 * Vatikanstaten eller Maldivene: oppløsningen slipper dem gjennom nettet. 50m
 * har dem alle, og gir samtidig kystlinjer verdt navnet — Norge går fra 88 til
 * nesten to tusen punkter, og fjordene kommer fram.
 *
 * `playable` skiller svar fra kulisse. Suverene stater (`independent` i
 * world-countries) pluss Kosovo er svar — 194 av dem. Oversjøiske territorier,
 * kronbesittelser og områder uten egen ISO-kode blir *tegnet*, så kartet ikke
 * har hull der Grønland og Vest-Sahara skal være, men er ingen å gjette på.
 * `toQuizFeatures` i game/types.ts er det som håndhever skillet.
 */

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import { topology as toTopology } from 'topojson-server'
import { presimplify, simplify, quantile } from 'topojson-simplify'
import { optimize } from 'svgo'
import { dropRepeats, roundGeometry } from './lib/sources.mjs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const OUT_DIR = resolve(ROOT, 'src/data/world')
const OUT_JSON = resolve(OUT_DIR, 'countries.json')
const OUT_OUTLINE = resolve(OUT_DIR, 'outline.json')
const FLAG_DIR = resolve(OUT_DIR, 'flags')
const FLAG_SRC = resolve(ROOT, 'node_modules/flag-icons/flags/4x3')

const HINT =
  'npm i --no-save world-atlas@2 topojson-client@3 topojson-server@3 topojson-simplify@3 world-countries@5 flag-icons@7 svgo@3'
for (const path of ['world-atlas/countries-50m.json', 'world-countries', 'flag-icons/flags/4x3', 'svgo']) {
  if (!existsSync(resolve(ROOT, 'node_modules', path))) {
    throw new Error(`Fant ikke ${path}. Kjør:\n  ${HINT}`)
  }
}

const topology = JSON.parse(
  readFileSync(resolve(ROOT, 'node_modules/world-atlas/countries-50m.json'), 'utf8'),
)
const world = feature(topology, topology.objects.countries)

/**
 * 50m tar med alle mikrostatene, men ikke helt alle: Tuvalu — ni atoller,
 * ingen større enn et par kilometer — faller fortsatt utenfor. Ett FN-medlem
 * skal ikke mangle fra verdenskartet fordi det er lite, så de få som 50m ikke
 * har, hentes fra 10m i stedet. Samme kilde, samme rørledning, bare finere
 * målestokk der det trengs.
 */
const fine = feature(
  JSON.parse(readFileSync(resolve(ROOT, 'node_modules/world-atlas/countries-10m.json'), 'utf8')),
  'countries',
)
const countries = require('world-countries')

/** ccn3 → ISO 3166-1 alpha-2 (små bokstaver), engelsk kortnavn og suverenitet. */
const byCcn3 = new Map()
for (const c of countries) {
  if (c.ccn3) {
    byCcn3.set(c.ccn3, {
      iso2: c.cca2.toLowerCase(),
      en: c.name.common,
      independent: c.independent === true,
    })
  }
}
// Kosovo har ingen offisiell numerisk kode; world-atlas gir feature-en ingen id.
const KOSOVO = { id: 'XK', iso2: 'xk', name: 'Kosovo', nameEn: 'Kosovo', playable: true }

/**
 * Flater uten ISO-kode. De ble tidligere kastet, og etterlot hull i kartet der
 * Nord-Kypros og Somaliland ligger. Nå tegnes de som land uten å være svar —
 * `playable: false` sier alt som trengs, og den syntetiske id-en er bare en
 * nøkkel, ikke en påstand om hvem som eier hva.
 */
const CODELESS = new Map([
  ['Somaliland', ['Somaliland', 'Somaliland']],
  ['N. Cyprus', ['Nord-Kypros', 'Northern Cyprus']],
  ['Indian Ocean Ter.', ['Indiahavsøyene', 'Indian Ocean Territories']],
  ['Siachen Glacier', ['Siachenbreen', 'Siachen Glacier']],
])

const noName = new Intl.DisplayNames(['nb'], { type: 'region' })
const enName = new Intl.DisplayNames(['en'], { type: 'region' })

/**
 * Kaster ringer som spenner over antimeridianen.
 *
 * En ring fra 178°Ø til −179°Ø har et lengdespenn på 357 grader i tallenes
 * verden, og d3-geo tegner den som hele kloden: verdenskartet blir ett
 * ensfarget rektangel. Fiji er det klassiske tilfellet — og av de tjue ringene
 * øygruppa består av i 50m er det nøyaktig én som gjør dette. Å kaste den ene
 * koster en holme og gir landet tilbake til spillet.
 *
 * Grensen er 180 grader: ingen ekte ring i datasettet er så bred, og enhver
 * som ser slik ut, er en som har brettet seg rundt kloden.
 */
function dropAntimeridianRings(geometry) {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return geometry
  const span = (ring) => {
    const lons = ring.map((c) => c[0])
    return Math.max(...lons) - Math.min(...lons)
  }
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const kept = polys.filter((poly) => span(poly[0]) <= 180)
  if (!kept.length) return null
  return kept.length === 1
    ? { type: 'Polygon', coordinates: kept[0] }
    : { type: 'MultiPolygon', coordinates: kept }
}

/**
 * Utelatt:
 * - 010 Antarktis: fyller en tredjedel av kartet og har ingen å gjette.
 * - De subantarktiske territoriene: ubebodde, og de trekker kartets sørkant
 *   ned uten å vise annet enn is. Kartutsnittet skal ikke koste ti breddegrader
 *   for Heard Island.
 */
const EXCLUDE = new Set([
  '010', // Antarktis
  '074', // Bouvetøya
  '260', // De franske sørterritorier
  '334', // Heard- og McDonaldøyene
  '239', // Sør-Georgia og Sør-Sandwichøyene
])

const features = []
const missingFlag = []
/** koder som alt er tatt inn — vokter mot at 10m-runden dublerer noe */
const taken = new Set()

function ingest(f) {
  const id = f.id == null ? null : String(f.id)
  if (id && EXCLUDE.has(id)) return

  let entry
  if (id === null && f.properties?.name === 'Kosovo') {
    entry = KOSOVO
  } else if (id === null && CODELESS.has(f.properties?.name)) {
    // uten kode: tegnes, men er ingen å gjette på
    const [name, nameEn] = CODELESS.get(f.properties.name)
    entry = { id: `X-${f.properties.name.replace(/\W+/g, '')}`, name, nameEn, playable: false }
  } else if (id && byCcn3.has(id)) {
    const { iso2, en, independent } = byCcn3.get(id)
    entry = {
      id,
      iso2,
      name: noName.of(iso2.toUpperCase()) || en,
      nameEn: enName.of(iso2.toUpperCase()) || en,
      // territorier og kronbesittelser er kulisse, ikke svar
      playable: independent,
    }
  } else {
    return
  }

  // Et svar uten flagg kan ikke spilles i flaggmodusene, og blir droppet. En
  // kulisse trenger ikke flagg i det hele tatt.
  if (entry.playable && !existsSync(resolve(FLAG_SRC, `${entry.iso2}.svg`))) {
    missingFlag.push(`${entry.name} (${entry.iso2})`)
    return
  }

  // Tre desimaler ≈ 110 m, samme presisjon som resten av datasettene får av
  // scripts/optimise-geo.mjs. To — det som stod her — er drøyt en kilometer,
  // og visker ut nettopp de småøyene og fjordarmene 50m er hentet inn for.
  const clipped = dropAntimeridianRings(f.geometry)
  if (!clipped) return
  const geometry = dropRepeats(roundGeometry(clipped, 3))
  if (!geometry) return

  const properties = { id: entry.id, name: entry.name, nameEn: entry.nameEn }
  if (entry.iso2) properties.iso2 = entry.iso2
  if (!entry.playable) properties.playable = false

  features.push({ type: 'Feature', properties, geometry })
  taken.add(entry.id)
}

for (const f of world.features) ingest(f)

// andre runde: de suverene statene 50m ikke har, hentet fra 10m
for (const f of fine.features) {
  const id = f.id == null ? null : String(f.id)
  if (!id || taken.has(id) || EXCLUDE.has(id) || !byCcn3.get(id)?.independent) continue
  ingest(f)
}

/*
 * Slå sammen flater som deler kode.
 *
 * world-atlas 50m fører Australia som to features — fastlandet og de ytre
 * øyterritoriene — begge med kode 036. To features med samme id blir to like
 * svar i quizen, og et treff på det ene lar det andre stå igjen som uløst.
 * Ringene legges derfor i én MultiPolygon, slik landet er ett sted.
 */
const merged = new Map()
for (const f of features) {
  const seen = merged.get(f.properties.id)
  if (!seen) {
    merged.set(f.properties.id, f)
    continue
  }
  const rings = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
  seen.geometry = { type: 'MultiPolygon', coordinates: [...rings(seen.geometry), ...rings(f.geometry)] }
}
features.length = 0
features.push(...merged.values())

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

/*
 * Omrisset — en grovere kopi av det samme.
 *
 * Landingssiden og bakgrunnskartet tegner hele kloden i én plate. Der er
 * Norge seksti piksler bred, og på seksti piksler er en fjord en tagg: det
 * trengs et par hundre punkter for at kysten skal *se* norsk ut, ikke to
 * tusen. Spillkartet trenger de to tusen — der kan man zoome inn på
 * Sognefjorden — men å la hver besøkende laste dem ned før noe er valgt, er
 * en tredobling av oppstarten for detaljer ingen skjerm viser.
 *
 * Regionen peker derfor `outline` hit og `load` på countries.json. Samme
 * features, samme id-er, samme egenskaper — en firedel av punktene.
 *
 * Flater der ingen enkeltring er større enn én grad slipper unna urørt. Malta
 * er 0,39 grader bred, og en forenkling som gjør fjorder til tagger gjør
 * småstater til ingenting; se samme regel i scripts/simplify-geo.mjs.
 */
const OUTLINE_KEEP = 0.25
const OUTLINE_MIN_SPAN = 1

function largestRingSpan(geometry) {
  let largest = 0
  const walk = (node) => {
    if (typeof node[0][0] !== 'number') return node.forEach(walk)
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

const big = []
const bigAt = []
features.forEach((f, i) => {
  if (largestRingSpan(f.geometry) >= OUTLINE_MIN_SPAN) {
    big.push(f)
    bigAt.push(i)
  }
})
const topo = presimplify(toTopology({ layer: { type: 'FeatureCollection', features: big } }))
const thinned = feature(simplify(topo, quantile(topo, OUTLINE_KEEP)), 'layer')
const outlineFeatures = features.slice()
bigAt.forEach((at, i) => {
  // to desimaler etter forenklinga: punktene ligger nå titalls kilometer fra
  // hverandre, så en kilometers avrunding flytter ingenting man kan se — den
  // bare gjør hvert tall kortere, og filen er tusenvis av tall
  const geometry = dropRepeats(roundGeometry(thinned.features[i].geometry, 2))
  if (geometry) outlineFeatures[at] = { ...thinned.features[i], geometry }
})
const outline = { type: 'FeatureCollection', features: outlineFeatures }
writeFileSync(OUT_OUTLINE, JSON.stringify(outline))

// flaggsettet: bare de landene som faktisk er med, kjørt gjennom svgo. Noen
// flagg bærer et fullt våpenskjold og er 40–180 kB rå; svgo halverer settet.
rmSync(FLAG_DIR, { recursive: true, force: true })
mkdirSync(FLAG_DIR, { recursive: true })
const iso2map = {}
let rawBytes = 0
let optBytes = 0
for (const feat of features) {
  const { id, iso2, playable } = feat.properties
  if (playable === false) continue
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
const playable = features.filter((f) => f.properties.playable !== false).length
console.log(
  `Skrev ${features.length} flater (${playable} spillbare, ${features.length - playable} kulisse) ` +
    `til ${OUT_JSON.replace(ROOT + '/', '')} (${kb} kB)`,
)
const points = (fc) => {
  let n = 0
  const walk = (c) => (typeof c[0] === 'number' ? n++ : c.forEach(walk))
  for (const f of fc.features) walk(f.geometry.coordinates)
  return n
}
console.log(
  `Skrev omrisset til ${OUT_OUTLINE.replace(ROOT + '/', '')} ` +
    `(${Math.round(Buffer.byteLength(JSON.stringify(outline)) / 1024)} kB, ` +
    `${points(outline)} av ${points(collection)} punkt)`,
)
const flagKb = Math.round(readdirSync(FLAG_DIR).reduce((n, f) => n + statSync(resolve(FLAG_DIR, f)).size, 0) / 1024)
console.log(
  `Optimerte ${readdirSync(FLAG_DIR).length} flagg til ${FLAG_DIR.replace(ROOT + '/', '')} ` +
    `(${flagKb} kB, ${Math.round((1 - optBytes / rawBytes) * 100)} % mindre enn rått)`,
)
if (missingFlag.length) console.warn(`Uten flagg i settet, hoppet over: ${missingFlag.join(', ')}`)
