/**
 * Genererer datasettene til Afrika-regionen under src/data/africa/.
 *
 *   npm i --no-save world-atlas@2 topojson-client@3
 *   npm run data:africa
 *
 * Resultatet er sjekket inn. Kjør på nytt bare når lista over land, hovedsteder,
 * elver eller fjell skal endres.
 */

import { resolve } from 'node:path'
import { feature } from 'topojson-client'
import rewind from '@mapbox/geojson-rewind'
import {
  ROOT,
  clipLineToBoxes,
  clipPolygonToBox,
  dropRepeats,
  fromNodeModules,
  lineStrings,
  naturalEarth,
  normaliseName,
  round,
  roundGeometry,
  thinLine,
  writeCollection,
} from './lib/sources.mjs'

const OUT = resolve(ROOT, 'src/data/africa')

/**
 * Ringer med midtpunkt utenfor denne boksen blir forkastet.
 *
 * Vestgrensa −26°Ø tar med Kapp Verde. Østgrensa 58°Ø tar med Mauritius og
 * Seychellene, kontinentets østligste FN-medlemmer — uten den dropper de to
 * ut av `clipPolygonToBox` etter ringens midtpunkt, siden øystatene ligger
 * godt utenfor fastlandet. Ekstra seks grader tom Indiahavflate er prisen;
 * begge er mikrostater og er uansett avhengige av del 2 i planen (synlige
 * markører) for å være treffbare. Ingen land trenger `clipGeometryToBox`
 * slik Russland gjør i Europa/Asia — ingenting i Afrika strekker seg over
 * en regiongrense.
 */
const BOX = { minLon: -26, maxLon: 58, minLat: -36, maxLat: 38 }

/**
 * ISO 3166-1 numerisk → [norsk navn, engelsk navn].
 *
 * Alle 54 FN-medlemslandene i Afrika. Vest-Sahara (732) er utelatt — det er
 * ikke FN-medlem og ingen stat har udiskutert kontroll over det; det ville
 * vært et spørsmål uten omforent fasit. Kartet får rett og slett et hull der,
 * slik verdenskartet tegner det som kulisse uten å gjøre det til et svar.
 */
const COUNTRIES = new Map([
  [12, ['Algerie', 'Algeria']], [24, ['Angola', 'Angola']],
  [204, ['Benin', 'Benin']], [72, ['Botswana', 'Botswana']],
  [854, ['Burkina Faso', 'Burkina Faso']], [108, ['Burundi', 'Burundi']],
  [132, ['Kapp Verde', 'Cabo Verde']], [120, ['Kamerun', 'Cameroon']],
  [140, ['Den sentralafrikanske republikk', 'Central African Republic']],
  [148, ['Tsjad', 'Chad']], [174, ['Komorene', 'Comoros']],
  [180, ['Den demokratiske republikken Kongo', 'DR Congo']],
  [178, ['Republikken Kongo', 'Republic of the Congo']],
  [384, ['Elfenbenskysten', "Côte d'Ivoire"]], [262, ['Djibouti', 'Djibouti']],
  [818, ['Egypt', 'Egypt']], [226, ['Ekvatorial-Guinea', 'Equatorial Guinea']],
  [232, ['Eritrea', 'Eritrea']], [748, ['Eswatini', 'Eswatini']],
  [231, ['Etiopia', 'Ethiopia']], [266, ['Gabon', 'Gabon']],
  [270, ['Gambia', 'Gambia']], [288, ['Ghana', 'Ghana']],
  [324, ['Guinea', 'Guinea']], [624, ['Guinea-Bissau', 'Guinea-Bissau']],
  [404, ['Kenya', 'Kenya']], [426, ['Lesotho', 'Lesotho']],
  [430, ['Liberia', 'Liberia']], [434, ['Libya', 'Libya']],
  [450, ['Madagaskar', 'Madagascar']], [454, ['Malawi', 'Malawi']],
  [466, ['Mali', 'Mali']], [478, ['Mauritania', 'Mauritania']],
  [480, ['Mauritius', 'Mauritius']], [504, ['Marokko', 'Morocco']],
  [508, ['Mosambik', 'Mozambique']], [516, ['Namibia', 'Namibia']],
  [562, ['Niger', 'Niger']], [566, ['Nigeria', 'Nigeria']],
  [646, ['Rwanda', 'Rwanda']],
  [678, ['São Tomé og Príncipe', 'São Tomé and Príncipe']],
  [686, ['Senegal', 'Senegal']], [690, ['Seychellene', 'Seychelles']],
  [694, ['Sierra Leone', 'Sierra Leone']], [706, ['Somalia', 'Somalia']],
  [710, ['Sør-Afrika', 'South Africa']], [728, ['Sør-Sudan', 'South Sudan']],
  [729, ['Sudan', 'Sudan']], [834, ['Tanzania', 'Tanzania']],
  [768, ['Togo', 'Togo']], [788, ['Tunisia', 'Tunisia']],
  [800, ['Uganda', 'Uganda']], [894, ['Zambia', 'Zambia']],
  [716, ['Zimbabwe', 'Zimbabwe']],
])

/**
 * ISO-3 landkode → [norsk navn, engelsk navn] for hovedstaden.
 *
 * De fleste rader plukkes rett fra `ne_50m_populated_places` sin
 * `ADM0CAP === 1`-flagg. Fire land trenger hjelp:
 *
 * - Sør-Afrika har tre ADM0CAP-rader (Pretoria, Kapstaden, Bloemfontein) —
 *   `CAPITAL_NAME_OVERRIDE` sikrer at det er nettopp Pretoria-raden som
 *   plukkes, ikke bare den som står først i kildefila.
 * - Elfenbenskysten har to (Yamoussoukro, Abidjan) — samme fiks, for
 *   Yamoussoukro, den grunnlovfestede hovedstaden.
 * - Benin og Tanzania har bare én ADM0CAP-rad hver i dette datasettet
 *   (Cotonou og Dar es Salaam — de facto regjeringssentre), mens
 *   Porto-Novo og Dodoma, de grunnlovfestede hovedstedene, ligger i samme
 *   fil med `ADM0CAP: 0`. `CAPITAL_AT_OVERRIDE` henter koordinatene deres
 *   direkte derfra.
 * - Sør-Sudan mangler helt fra ADM0CAP-utvalget — datasettet ser ut til å
 *   stamme fra før 2011. Juba finnes likevel i fila under sitt eget navn,
 *   bare uflagget, så koordinatene er hentet derfra på samme måte.
 */
const CAPITALS = new Map([
  ['DZA', ['Alger', 'Algiers']], ['AGO', ['Luanda', 'Luanda']],
  ['BEN', ['Porto-Novo', 'Porto-Novo']], ['BWA', ['Gaborone', 'Gaborone']],
  ['BFA', ['Ouagadougou', 'Ouagadougou']], ['BDI', ['Bujumbura', 'Bujumbura']],
  ['CPV', ['Praia', 'Praia']], ['CMR', ['Yaoundé', 'Yaoundé']],
  ['CAF', ['Bangui', 'Bangui']], ['TCD', ["N'Djamena", "N'Djamena"]],
  ['COM', ['Moroni', 'Moroni']], ['COD', ['Kinshasa', 'Kinshasa']],
  ['COG', ['Brazzaville', 'Brazzaville']], ['CIV', ['Yamoussoukro', 'Yamoussoukro']],
  ['DJI', ['Djibouti', 'Djibouti']], ['EGY', ['Kairo', 'Cairo']],
  ['GNQ', ['Malabo', 'Malabo']], ['ERI', ['Asmara', 'Asmara']],
  ['SWZ', ['Mbabane', 'Mbabane']], ['ETH', ['Addis Abeba', 'Addis Ababa']],
  ['GAB', ['Libreville', 'Libreville']], ['GMB', ['Banjul', 'Banjul']],
  ['GHA', ['Accra', 'Accra']], ['GIN', ['Conakry', 'Conakry']],
  ['GNB', ['Bissau', 'Bissau']], ['KEN', ['Nairobi', 'Nairobi']],
  ['LSO', ['Maseru', 'Maseru']], ['LBR', ['Monrovia', 'Monrovia']],
  ['LBY', ['Tripoli', 'Tripoli']], ['MDG', ['Antananarivo', 'Antananarivo']],
  ['MWI', ['Lilongwe', 'Lilongwe']], ['MLI', ['Bamako', 'Bamako']],
  ['MRT', ['Nouakchott', 'Nouakchott']], ['MUS', ['Port Louis', 'Port Louis']],
  ['MAR', ['Rabat', 'Rabat']], ['MOZ', ['Maputo', 'Maputo']],
  ['NAM', ['Windhoek', 'Windhoek']], ['NER', ['Niamey', 'Niamey']],
  ['NGA', ['Abuja', 'Abuja']], ['RWA', ['Kigali', 'Kigali']],
  ['STP', ['São Tomé', 'São Tomé']], ['SEN', ['Dakar', 'Dakar']],
  ['SYC', ['Victoria', 'Victoria']], ['SLE', ['Freetown', 'Freetown']],
  ['SOM', ['Mogadishu', 'Mogadishu']], ['ZAF', ['Pretoria', 'Pretoria']],
  ['SSD', ['Juba', 'Juba']], ['SDN', ['Khartoum', 'Khartoum']],
  ['TZA', ['Dodoma', 'Dodoma']], ['TGO', ['Lomé', 'Lomé']],
  ['TUN', ['Tunis', 'Tunis']], ['UGA', ['Kampala', 'Kampala']],
  ['ZMB', ['Lusaka', 'Lusaka']], ['ZWE', ['Harare', 'Harare']],
])

/** Land med mer enn én ADM0CAP-rad — bare denne NE-`NAME`-verdien godtas. */
const CAPITAL_NAME_OVERRIDE = new Map([
  ['ZAF', 'Pretoria'],
  ['CIV', 'Yamoussoukro'],
])

/**
 * Land der den grunnlovfestede hovedstaden ikke er ADM0CAP-flagget i
 * kildedataene. Koordinatene er hentet manuelt fra det samme
 * `ne_50m_populated_places`-datasettet (raden finnes, bare uflagget), unntatt
 * Sør-Sudan, som mangler helt og har fått Jubas offentlig kjente koordinater.
 */
const CAPITAL_AT_OVERRIDE = new Map([
  ['BEN', [2.617, 6.483]],
  ['TZA', [35.75, -6.183]],
  ['SSD', [31.58, 4.83]],
])

/**
 * Elver, med Natural Earths segmentnavn.
 *
 * Nilen er delt opp akkurat som Yangtze i Asia: hver strekning har sitt eget
 * lokale navn i kildedataene. «Hvite Nilen» og «Blå Nilen» heter i
 * `ne_50m_rivers_lake_centerlines` «El Bahr el Abyad» og «El Bahr el Azraq» —
 * de arabiske navnene datasettet faktisk bruker, ikke de norske/engelske vi
 * kjenner dem som.
 *
 * Senegalelva finnes ikke som navngitt linje i Natural Earth, verken i 50m-
 * eller 10m-utgaven — den er utelatt heller enn gjettet på med et enkelt
 * `at`-punkt slik fjellene under gjør, siden elva ville blitt en løsrevet
 * prikk uten forløp.
 */
const RIVERS = [
  {
    id: 'Nilen',
    name: 'Nilen',
    nameEn: 'Nile',
    parts: ['Nile', 'El Bahr el Abyad', 'El Bahr el Azraq', 'Bahr el Jebel', 'Victoria Nile', 'Albert Nile'],
  },
  { id: 'Kongo', name: 'Kongo', nameEn: 'Congo', parts: ['Congo', 'Lualaba'] },
  { id: 'Niger', name: 'Niger', parts: ['Niger'] },
  { id: 'Zambezi', name: 'Zambezi', parts: ['Zambezi'] },
  { id: 'Oranjeelva', name: 'Oranjeelva', nameEn: 'Orange', parts: ['Orange'] },
  { id: 'Limpopo', name: 'Limpopo', parts: ['Limpopo'] },
  { id: 'Volta', name: 'Volta', parts: ['Volta'] },
  { id: 'Okavango', name: 'Okavango', parts: ['Okavango'] },
  { id: 'Kasai', name: 'Kasai', parts: ['Kasai'] },
  { id: 'Ubangi', name: 'Ubangi', parts: ['Ubangi'] },
  // Jubba finnes i 50m-datasettet; Shabeelle (nabovassdraget, munner ut like
  // sør for det) dukker først opp i 10m — se `RIVER_FALLBACK_SOURCE` under.
  { id: 'Jubba', name: 'Jubba', parts: ['Jubba'] },
  { id: 'Shabeelle', name: 'Shabeelle', parts: ['Shabeelle'] },
]

/** Elvenavn som bare finnes i det finere 10m-datasettet, ikke i 50m. */
const RIVER_FALLBACK_SOURCE = 'ne_10m_rivers_lake_centerlines'

/**
 * Fjell, med navnet de har i Natural Earths høydepunkt-datasett.
 *
 * Tre av dem — Meru, Nyiragongo og Jbel Ayachi — finnes ikke i utvalget i det
 * hele tatt, samme situasjon som Kangchenjunga/Annapurna i Asia. Koordinatene
 * står derfor rett i lista, med `at`.
 */
const PEAKS = [
  { source: 'Mount Kilimanjaro', id: 'Kilimanjaro', name: 'Kilimanjaro' },
  { source: 'Mount Kenya', id: 'MountKenya', name: 'Mount Kenya' },
  { source: 'Ras Dejen', id: 'RasDashen', name: 'Ras Dashen' },
  { source: 'Mount Stanley', id: 'MountStanley', name: 'Mount Stanley' },
  { id: 'MountMeru', name: 'Mount Meru', at: [36.75, -3.23] },
  { source: 'Mont Cameroun', id: 'MountCameroon', name: 'Mount Cameroon' },
  { source: 'Jebel Toubkal', id: 'Toubkal', name: 'Toubkal' },
  { source: 'Thabana Ntlenyana', id: 'ThabanaNtlenyana', name: 'Thabana Ntlenyana' },
  { source: 'Emi Koussi', id: 'EmiKoussi', name: 'Emi Koussi' },
  { source: 'Volcan Karisimbi', id: 'Karisimbi', name: 'Karisimbi' },
  { source: 'Mount Elgon', id: 'MountElgon', name: 'Mount Elgon' },
  { id: 'JbelAyachi', name: 'Jbel Ayachi', at: [-4.983, 32.5] },
  { source: 'Pico de Cano', id: 'PicoDoFogo', name: 'Pico do Fogo' },
  { id: 'Nyiragongo', name: 'Nyiragongo', at: [29.25, -1.52] },
]

async function buildCountries() {
  const topology = fromNodeModules('world-atlas/countries-50m.json')
  const world = feature(topology, topology.objects.countries)
  const features = []
  const missing = new Set(COUNTRIES.keys())

  for (const f of world.features) {
    const code = Number(f.id)
    if (!COUNTRIES.has(code)) continue
    missing.delete(code)
    const [name, nameEn] = COUNTRIES.get(code)
    const clipped = clipPolygonToBox(f.geometry, BOX)
    if (!clipped) {
      console.warn(`  ! ${name} falt utenfor Afrika-boksen — hoppet over`)
      continue
    }
    // Afrika er stort: hele regionen blir presset inn i 900 px høyde, så 2
    // desimaler (~1 km) er alt kartet klarer å vise uansett — samme
    // vurdering som i Asia.
    //
    // Id-en er nullpolstret til tre siffer, i motsetning til Asia. Verdens-
    // flaggsettet i src/data/world/flags.json er nøkla på tresifrede koder
    // ("012", "024", "072"), og `africaFlags`-kategorien slår opp
    // `properties.id` der direkte. Uten polstringa mister Algerie (12),
    // Angola (24) og Botswana (72) flagget sitt stille og rolig.
    features.push({
      type: 'Feature',
      properties: { id: String(code).padStart(3, '0'), name, nameEn },
      geometry: dropRepeats(roundGeometry(clipped, 2)),
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  /*
   * d3-geo leser et polygon sfærisk: hvilken side av ringen som er «inne»
   * følger av hvilken vei den går. En ytterring som går feil vei blir tegnet
   * som resten av kloden. Klippingen holder orienteringen, men samlingen blir
   * normalisert til med klokka rundt ytterringen uansett — den konvensjonen
   * d3 regner med.
   */
  writeCollection(
    resolve(OUT, 'countries.json'),
    rewind({ type: 'FeatureCollection', features }, true).features,
  )
  if (missing.size > 0) {
    console.warn(
      `  ! fantes ikke i datasettet: ${[...missing].map((c) => COUNTRIES.get(c)[0]).join(', ')}`,
    )
  }
}

async function buildCapitals() {
  const places = await naturalEarth('ne_50m_populated_places')
  const features = []
  const missing = new Set(CAPITALS.keys())

  for (const f of places.features) {
    const p = f.properties
    if (p.ADM0CAP !== 1 || !missing.has(p.ADM0_A3)) continue
    // Benin og Tanzania har en ADM0CAP-rad hver, men det er regjeringssetet
    // (Cotonou, Dar es Salaam), ikke den grunnlovfestede hovedstaden — de
    // skal forbi denne løkka og hentes fra `CAPITAL_AT_OVERRIDE` under.
    if (CAPITAL_AT_OVERRIDE.has(p.ADM0_A3)) continue
    const expectedName = CAPITAL_NAME_OVERRIDE.get(p.ADM0_A3)
    if (expectedName && p.NAME !== expectedName) continue
    missing.delete(p.ADM0_A3)
    const [name, nameEn] = CAPITALS.get(p.ADM0_A3)
    features.push({
      type: 'Feature',
      properties: { id: name.replace(/[^A-Za-z]/g, ''), name, nameEn },
      geometry: roundGeometry(f.geometry),
    })
  }

  // Landene der ADM0CAP-flagget peker feil vei eller mangler helt — se
  // kommentaren over CAPITAL_AT_OVERRIDE.
  for (const [iso3, at] of CAPITAL_AT_OVERRIDE) {
    if (!missing.has(iso3)) continue
    missing.delete(iso3)
    const [name, nameEn] = CAPITALS.get(iso3)
    features.push({
      type: 'Feature',
      properties: { id: name.replace(/[^A-Za-z]/g, ''), name, nameEn },
      geometry: { type: 'Point', coordinates: at },
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'capitals.json'), features)
  if (missing.size > 0) console.warn(`  ! uten treff: ${[...missing].join(', ')}`)
}

async function buildRivers() {
  const source = await naturalEarth('ne_50m_rivers_lake_centerlines')
  const segments = new Map()
  for (const f of source.features) {
    const key = normaliseName(f.properties.name)
    if (!key) continue
    if (!segments.has(key)) segments.set(key, [])
    segments.get(key).push(f)
  }

  // Hentes bare fra nettet/cachen om noe faktisk trenger den — de fleste
  // elvene finnes alt i 50m-utvalget over.
  let fine = null
  async function fineSegmentsFor(key) {
    if (!fine) fine = await naturalEarth(RIVER_FALLBACK_SOURCE)
    return fine.features.filter((f) => normaliseName(f.properties.name) === key)
  }

  const features = []
  for (const river of RIVERS) {
    const parts = []
    for (const partName of river.parts) {
      let matches = segments.get(partName) ?? []
      if (matches.length === 0) matches = await fineSegmentsFor(partName)
      for (const f of matches) {
        for (const line of lineStrings(f.geometry)) {
          for (const piece of clipLineToBoxes(line, [BOX])) {
            parts.push(thinLine(piece, 0.05).map(([x, y]) => [round(x, 2), round(y, 2)]))
          }
        }
      }
    }
    if (parts.length === 0) {
      console.warn(`  ! ingen segmenter for ${river.name}`)
      continue
    }
    features.push({
      type: 'Feature',
      properties: {
        id: river.id,
        name: river.name,
        ...(river.nameEn ? { nameEn: river.nameEn } : {}),
      },
      geometry:
        parts.length === 1
          ? { type: 'LineString', coordinates: parts[0] }
          : { type: 'MultiLineString', coordinates: parts },
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'rivers.json'), features)
}

async function buildPeaks() {
  const source = await naturalEarth('ne_10m_geography_regions_elevation_points')
  const byName = new Map(
    source.features
      .filter((f) => f.properties.featurecla === 'mountain')
      .map((f) => [normaliseName(f.properties.name), f]),
  )

  const features = []
  for (const peak of PEAKS) {
    const coordinates = peak.at ?? byName.get(peak.source)?.geometry.coordinates
    if (!coordinates) {
      console.warn(`  ! fant ikke ${peak.name} (${peak.source})`)
      continue
    }
    features.push({
      type: 'Feature',
      properties: {
        id: peak.id,
        name: peak.name,
        ...(peak.nameEn ? { nameEn: peak.nameEn } : {}),
      },
      geometry: { type: 'Point', coordinates: coordinates.map((c) => round(c)) },
    })
  }

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
  writeCollection(resolve(OUT, 'peaks.json'), features)
}

console.log('Afrika:')
await buildCountries()
await buildCapitals()
await buildRivers()
await buildPeaks()
