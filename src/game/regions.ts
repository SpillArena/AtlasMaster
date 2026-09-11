import type { FeatureCollection } from 'geojson'
import type { Category, Region } from './types'

/**
 * Registeret over spillbare regioner. Dette er det eneste stedet som må
 * endres for å åpne et nytt kontinent — legg inn GeoJSON under
 * `src/data/<region>/`, skriv en `Region` her, og resten av spillet følger med.
 *
 * Hver `load` er en dynamisk import, så datasettene blir kodesplittet og hentet
 * først når noen faktisk velger kategorien. Europa-omrisset alene er 208 kB —
 * det skal ikke ligge i hovedbundelen for en som bare spiller Norge.
 */

const json = (loader: () => Promise<{ default: unknown }>) => async () =>
  (await loader()).default as unknown as FeatureCollection

const norwayCounties = json(() => import('../data/norway/counties.json'))
const europeCountries = json(() => import('../data/europe/countries.json'))
const asiaCountries = json(() => import('../data/asia/countries.json'))
const africaCountries = json(() => import('../data/africa/countries.json'))
const usStates = json(() => import('../data/usa/states.json'))
const worldCountries = json(() => import('../data/world/countries.json'))
/**
 * Verdenskartet i to oppløsninger.
 *
 * `countries` er spillbildet: 50m-geometri der man kan zoome inn på
 * Sognefjorden. `outline` er det samme kartet med en firedel av punktene, og
 * er det landingssiden og bakgrunnen tegner — der er hele kloden ni hundre
 * piksler bred, og resten er detaljer ingen skjerm viser. Forskjellen er
 * fire hundre kilobyte hver besøkende slipper å laste ned før noe er valgt.
 * Begge kommer fra scripts/build-world.mjs og deler id-er.
 */
const worldOutline = json(() => import('../data/world/outline.json'))

/**
 * MERK — kategori-id-ene til Norge er med vilje norske og uendret
 * (`fylker`, `storbyer`, `elver`, `fjell`). De ligger lagret som `category` på
 * hver rad i D1-ledertavla fra før regionene fantes. Døper vi dem om, mister
 * alle eksisterende resultat kategorien sin. Europa får derfor sine egne
 * id-er i stedet for å dele disse — noe som uansett er riktigere: et fylke
 * er ikke et land.
 */
const norwayCategories: Category[] = [
  {
    id: 'fylker',
    labelKey: 'cat.fylker',
    geom: 'polygon',
    icon: 'map',
    color: '#10b981',
    gradient: 'from-emerald-600 via-[#0f6b47] to-[#0a2e24]',
    load: norwayCounties,
  },
  {
    id: 'storbyer',
    labelKey: 'cat.storbyer',
    geom: 'point',
    icon: 'buildings',
    color: '#0ea5e9',
    gradient: 'from-[#3a5fcd] via-[#182a6e] to-[#0a1230]',
    load: json(() => import('../data/norway/cities.json')),
    base: norwayCounties,
  },
  {
    id: 'elver',
    labelKey: 'cat.elver',
    geom: 'line',
    icon: 'river',
    color: '#06b6d4',
    gradient: 'from-cyan-600 via-[#0e7490] to-[#0b3a4a]',
    load: json(() => import('../data/norway/rivers.json')),
    base: norwayCounties,
  },
  {
    id: 'fjell',
    labelKey: 'cat.fjell',
    geom: 'point',
    icon: 'mountain',
    color: '#f59e0b',
    gradient: 'from-stone-500 via-[#57534e] to-[#1c1917]',
    load: json(() => import('../data/norway/peaks.json')),
    base: norwayCounties,
  },
]

const europeCategories: Category[] = [
  {
    id: 'countries',
    labelKey: 'cat.countries',
    geom: 'polygon',
    icon: 'map',
    color: '#8b5cf6',
    gradient: 'from-violet-600 via-[#4c1d95] to-[#1e1035]',
    load: europeCountries,
    emblems: 'europe',
  },
  {
    id: 'capitals',
    labelKey: 'cat.capitals',
    geom: 'point',
    icon: 'buildings',
    color: '#f43f5e',
    gradient: 'from-rose-600 via-[#881337] to-[#2a0a14]',
    load: json(() => import('../data/europe/capitals.json')),
    base: europeCountries,
  },
  {
    id: 'rivers',
    labelKey: 'cat.rivers',
    geom: 'line',
    icon: 'river',
    color: '#06b6d4',
    gradient: 'from-cyan-600 via-[#0e7490] to-[#0b3a4a]',
    load: json(() => import('../data/europe/rivers.json')),
    base: europeCountries,
  },
  {
    id: 'peaks',
    labelKey: 'cat.peaks',
    geom: 'point',
    icon: 'mountain',
    color: '#f59e0b',
    gradient: 'from-amber-600 via-[#78350f] to-[#1c1917]',
    load: json(() => import('../data/europe/peaks.json')),
    base: europeCountries,
  },
]

/**
 * MERK — kategori-id-ene må være unike på tvers av *alle* regioner, ikke
 * bare innenfor sin egen. Flis-teksten blir slått opp som `tile.<id>`, så
 * to regioner med hver sin «countries» ville delt samme beskrivelse. Derfor er
 * Asia og USA sine prefikset, mens Europa fikk de korte navnene først.
 */
const asiaCategories: Category[] = [
  {
    id: 'asiaCountries',
    labelKey: 'cat.countries',
    geom: 'polygon',
    icon: 'map',
    color: '#f97316',
    gradient: 'from-orange-600 via-[#7c2d12] to-[#2a1206]',
    load: asiaCountries,
  },
  {
    id: 'asiaCapitals',
    labelKey: 'cat.capitals',
    geom: 'point',
    icon: 'buildings',
    color: '#e11d48',
    gradient: 'from-rose-600 via-[#7f1d1d] to-[#2a0a12]',
    load: json(() => import('../data/asia/capitals.json')),
    base: asiaCountries,
  },
  {
    id: 'asiaRivers',
    labelKey: 'cat.rivers',
    geom: 'line',
    icon: 'river',
    color: '#06b6d4',
    gradient: 'from-teal-600 via-[#115e59] to-[#0b2f2c]',
    load: json(() => import('../data/asia/rivers.json')),
    base: asiaCountries,
  },
  {
    id: 'asiaPeaks',
    labelKey: 'cat.peaks',
    geom: 'point',
    icon: 'mountain',
    color: '#f59e0b',
    gradient: 'from-amber-500 via-[#78350f] to-[#1c1917]',
    load: json(() => import('../data/asia/peaks.json')),
    base: asiaCountries,
  },
]

const usaCategories: Category[] = [
  {
    id: 'usStates',
    labelKey: 'cat.states',
    geom: 'polygon',
    icon: 'map',
    color: '#3b82f6',
    gradient: 'from-blue-600 via-[#1e3a8a] to-[#0b1533]',
    load: usStates,
    emblems: 'usStates',
  },
  {
    id: 'usCities',
    labelKey: 'cat.cities',
    geom: 'point',
    icon: 'buildings',
    color: '#ef4444',
    gradient: 'from-red-600 via-[#7f1d1d] to-[#2a0a0a]',
    load: json(() => import('../data/usa/cities.json')),
    base: usStates,
  },
  {
    id: 'usRivers',
    labelKey: 'cat.rivers',
    geom: 'line',
    icon: 'river',
    color: '#06b6d4',
    gradient: 'from-sky-600 via-[#0c4a6e] to-[#08283d]',
    load: json(() => import('../data/usa/rivers.json')),
    base: usStates,
  },
  {
    id: 'usPeaks',
    labelKey: 'cat.peaks',
    geom: 'point',
    icon: 'mountain',
    color: '#f59e0b',
    gradient: 'from-stone-500 via-[#57534e] to-[#1c1917]',
    load: json(() => import('../data/usa/peaks.json')),
    base: usStates,
  },
]

/**
 * Afrika — samme fire kategoriene som Asia, pluss flagg.
 *
 * Flaggkategorien låner bildesettet verdensregionen alt har under
 * src/data/world/flags/. Oppslaget går på `properties.id`, og der er nøkkelen
 * ISO 3166-1 numerisk med tre siffer — «012», ikke «12». Derfor skriver
 * scripts/build-africa.mjs id-ene nullpolstret, i motsetning til Asia: uten
 * det ville Algerie, Angola og Botswana stått uten flagg, og ingen feilmelding
 * hadde sagt fra. `flagImageFor` gir null, og FlagBadge tegner ingenting.
 */
const africaCategories: Category[] = [
  {
    id: 'africaCountries',
    labelKey: 'cat.countries',
    geom: 'polygon',
    icon: 'map',
    color: '#65a30d',
    gradient: 'from-lime-600 via-[#3f6212] to-[#152505]',
    load: africaCountries,
    emblems: 'world',
  },
  {
    id: 'africaCapitals',
    labelKey: 'cat.capitals',
    geom: 'point',
    icon: 'buildings',
    color: '#e11d48',
    gradient: 'from-rose-600 via-[#7f1d1d] to-[#2a0a12]',
    load: json(() => import('../data/africa/capitals.json')),
    base: africaCountries,
  },
  {
    id: 'africaRivers',
    labelKey: 'cat.rivers',
    geom: 'line',
    icon: 'river',
    color: '#06b6d4',
    gradient: 'from-cyan-600 via-[#0e7490] to-[#0b3a4a]',
    load: json(() => import('../data/africa/rivers.json')),
    base: africaCountries,
  },
  {
    id: 'africaPeaks',
    labelKey: 'cat.peaks',
    geom: 'point',
    icon: 'mountain',
    color: '#f59e0b',
    gradient: 'from-amber-500 via-[#78350f] to-[#1c1917]',
    load: json(() => import('../data/africa/peaks.json')),
    base: africaCountries,
  },
  {
    id: 'africaFlags',
    labelKey: 'cat.africaFlags',
    geom: 'polygon',
    icon: 'seal',
    color: '#d97706',
    gradient: 'from-amber-600 via-[#78350f] to-[#231003]',
    load: africaCountries,
    emblems: 'world',
    modes: ['flag', 'pick'],
  },
]

/**
 * Verden — hele kloden, med to kategorier bygd på samme landdatasett.
 *
 * «Land» er et vanlig kartspill: klikk, flervalg eller skriv. «Flagg» bruker
 * flaggmodusene i stedet — se flagget og velg landet, eller se landet og velg
 * flagget — og har derfor `modes` satt eksplisitt. Begge deler `emblems:
 * 'world'`, bildesettet fra scripts/build-world.mjs.
 */
const worldCategories: Category[] = [
  {
    id: 'worldCountries',
    labelKey: 'cat.worldCountries',
    geom: 'polygon',
    icon: 'map',
    color: '#14b8a6',
    gradient: 'from-teal-600 via-[#134e4a] to-[#0b2b29]',
    load: worldCountries,
    emblems: 'world',
  },
  {
    id: 'worldFlags',
    labelKey: 'cat.worldFlags',
    geom: 'polygon',
    icon: 'seal',
    color: '#eab308',
    gradient: 'from-amber-500 via-[#78350f] to-[#1c1917]',
    load: worldCountries,
    emblems: 'world',
    modes: ['flag', 'pick'],
  },
]

export const regions: Region[] = [
  {
    id: 'norway',
    labelKey: 'region.norway',
    code: 'NO',
    gradient: 'from-[#1d4ed8] via-[#172554] to-[#080d1f]',
    // Standardparalleller 60/70 og rotasjon -15° gir det nord-strukne
    // landet rett form.
    projection: { kind: 'conicConformal', parallels: [60, 70], rotate: -15 },
    outline: norwayCounties,
    categories: norwayCategories,
  },
  {
    id: 'europe',
    labelKey: 'region.europe',
    code: 'EU',
    gradient: 'from-violet-700 via-[#3b1178] to-[#150a2b]',
    // ETRS89-LCC (EPSG:3034): standardparalleller 35/65, senterlengde 10°Ø.
    // Samme projeksjon som EU selv bruker til kontinentkart.
    projection: { kind: 'conicConformal', parallels: [35, 65], rotate: -10 },
    outline: europeCountries,
    categories: europeCategories,
  },
  {
    id: 'asia',
    labelKey: 'region.asia',
    code: 'AS',
    gradient: 'from-[#c2410c] via-[#7c2d12] to-[#2a1206]',
    // Asia spenner fra ekvator til 55°N og over 125 lengdegrader. En kjegle
    // gjør Indonesia til en banan i den ene enden av kartet; en azimutal
    // projeksjon sentrert midt i regionen holder formen i alle retninger.
    projection: { kind: 'azimuthalEqualArea', centre: [87, 22] },
    outline: asiaCountries,
    categories: asiaCategories,
  },
  {
    id: 'usa',
    labelKey: 'region.usa',
    code: 'US',
    gradient: 'from-[#1d4ed8] via-[#3b0d17] to-[#12040a]',
    // Alaska og Hawaii ligg i innfelte ruter — sjå scripts/build-usa.mjs.
    projection: { kind: 'albersUsa' },
    outline: usStates,
    categories: usaCategories,
  },
  {
    id: 'africa',
    labelKey: 'region.africa',
    code: 'AF',
    gradient: 'from-[#4d7c0f] via-[#3f6212] to-[#152505]',
    // Afrika ligger med en tredel av seg sør for ekvator. En kjegle med
    // standardparalleller må velge en halvkule å stå støtt på, og strekker
    // den andre; en azimutal projeksjon sentrert nær ekvator holder formen
    // begge veier. Samme resonnement som Asia — se kommentaren der.
    projection: { kind: 'azimuthalEqualArea', centre: [20, 2] },
    outline: africaCountries,
    categories: africaCategories,
  },
  {
    id: 'world',
    labelKey: 'region.world',
    code: 'WLD',
    gradient: 'from-teal-700 via-[#134e4a] to-[#0b2620]',
    // Natural Earth 1 — kompromissprojeksjonen laget nettopp for verdenskart:
    // polene krympes, formene holder seg, og ingenting strekkes ut mot kantene.
    projection: { kind: 'naturalEarth' },
    outline: worldOutline,
    categories: worldCategories,
  },
]

/** Regionen spillet starter i når ingenting er valgt. */
export const DEFAULT_REGION_ID = 'norway'

export function getRegion(id: string): Region | undefined {
  return regions.find((r) => r.id === id)
}

export function getCategory(regionId: string, categoryId: string): Category | undefined {
  return getRegion(regionId)?.categories.find((c) => c.id === categoryId)
}
