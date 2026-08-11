import type { FeatureCollection } from 'geojson'
import type { Category, Region } from './types'

/**
 * Registeret over spillbare regioner. Dette er den einaste staden som må
 * endrast for å opne eit nytt kontinent — legg inn GeoJSON under
 * `src/data/<region>/`, skriv ein `Region` her, og resten av spelet føl med.
 *
 * Kvar `load` er ein dynamisk import, så datasetta blir kodesplitta og henta
 * først når nokon faktisk vel kategorien. Europa-omrisset åleine er 208 kB —
 * det skal ikkje ligge i hovudbundelen for ein som berre spelar Noreg.
 */

const json = (loader: () => Promise<{ default: unknown }>) => async () =>
  (await loader()).default as unknown as FeatureCollection

const norwayCounties = json(() => import('../data/norway/counties.json'))
const europeCountries = json(() => import('../data/europe/countries.json'))

/**
 * MERK — kategori-id-ane til Noreg er med vilje norske og uendra
 * (`fylker`, `storbyer`, `elver`, `fjell`). Dei ligg lagra som `category` på
 * kvar rad i D1-leiartavla frå før regionane fanst. Døyper vi dei om, mistar
 * alle eksisterande resultat kategorien sin. Europa får difor sine eigne
 * id-ar i staden for å dele desse — noko som uansett er rettare: eit fylke
 * er ikkje eit land.
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

export const regions: Region[] = [
  {
    id: 'norway',
    labelKey: 'region.norway',
    code: 'NO',
    gradient: 'from-[#1d4ed8] via-[#172554] to-[#080d1f]',
    // Standardparallellar 60/70 og rotasjon -15° gjev det nord-strekte
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
    // ETRS89-LCC (EPSG:3034): standardparallellar 35/65, senterlengd 10°Ø.
    // Same projeksjon som EU sjølv brukar til kontinentkart.
    projection: { kind: 'conicConformal', parallels: [35, 65], rotate: -10 },
    outline: europeCountries,
    categories: europeCategories,
  },
]

/** Regionen spelet startar i når ingenting er valt. */
export const DEFAULT_REGION_ID = 'norway'

export function getRegion(id: string): Region | undefined {
  return regions.find((r) => r.id === id)
}

export function getCategory(regionId: string, categoryId: string): Category | undefined {
  return getRegion(regionId)?.categories.find((c) => c.id === categoryId)
}
