import type { Geometry, FeatureCollection } from 'geojson'
import type { IconName } from '../components/Icon'

/** Ett spillbart geografi-objekt (fylke, land, by, ...). */
export interface QuizFeature {
  id: string
  /** navnet som vises — på spillerens språk */
  name: string
  /** alle godtatte skrivemåter, uansett språk */
  aliases: string[]
  geometry: Geometry
}

export type GeomKind = 'polygon' | 'point' | 'line'

/** Spillmoduser. click = klikk riktig på kart; choice = velg navn; type = skriv navn. */
export type Mode = 'click' | 'choice' | 'type'

export const MODES: Mode[] = ['click', 'choice', 'type']

/** Tempo — hvor lang tid du har per spørsmål, og hva runden er verdt. */
export type Pace = 'relaxed' | 'normal' | 'blitz'

export const PACES: Pace[] = ['relaxed', 'normal', 'blitz']

export interface PaceDefinition {
  /** sekunder per spørsmål; 0 = ingen klokke */
  seconds: number
  /** poengmultiplikator — press betaler seg */
  multiplier: number
}

export const PACE_META: Record<Pace, PaceDefinition> = {
  relaxed: { seconds: 0, multiplier: 0.8 },
  normal: { seconds: 20, multiplier: 1 },
  blitz: { seconds: 8, multiplier: 1.4 },
}

export interface Category {
  id: string
  /** i18n-nøkkel for visningsnavn */
  labelKey: string
  geom: GeomKind
  /** lazy-lastet datasett (code-split per kategori) */
  load: () => Promise<FeatureCollection>
  /** valgfritt bakgrunns-omriss (f.eks. fylker bak by-punkter) */
  base?: () => Promise<FeatureCollection>
  /** ikon for flis (SVG, likt på alle enheter) */
  icon: IconName
  /** hex-farge for kart-uthevingen i flis */
  color: string
  /** tailwind-gradient for flisa (holdes hel for Tailwind JIT) */
  gradient: string
}

/**
 * Hvordan en region skal projiseres. Et land som strekker seg nord-sør og et
 * kontinent som strekker seg øst-vest tåler ikke samme projeksjon.
 *
 * `conicConformal` passer alt som ligger på midlere breddegrader — det er
 * standardvalget for både land og kontinenter. `azimuthalEqualArea` holder
 * formen på en region som spenner over et kvart jordklode i alle retninger.
 * `albersUsa` er sammensatt: den flytter Alaska og Hawaii inn i hver sin
 * innfelte rute, så alle 50 statene får plass på ett spillbart kart.
 * `naturalEarth` er der for et framtidig verdenskart.
 */
export type ProjectionSpec =
  | { kind: 'conicConformal'; parallels: [number, number]; rotate: number }
  | { kind: 'azimuthalEqualArea'; centre: [number, number] }
  | { kind: 'albersUsa' }
  | { kind: 'naturalEarth' }

/**
 * En spillbar region — Norge, Europa, og senere ett kontinent om gangen.
 *
 * Regionen eier sin egen projeksjon, sitt eget omriss og sine egne
 * kategorier. Å legge til et kontinent skal ikke kreve endringer noe annet
 * sted enn i regionlista: legg inn datasettene, skriv en `Region`, ferdig.
 */
export interface Region {
  id: string
  /** i18n-nøkkel for visningsnavn */
  labelKey: string
  /** kort kode i regionmerket, f.eks. «NO» / «EU» */
  code: string
  /** tailwind-gradient for regionflisa (holdes hel for Tailwind JIT) */
  gradient: string
  projection: ProjectionSpec
  /**
   * Omrisset som tegnes bak alt annet — bakgrunnskart og kategori-previews.
   * Som regel samme data som den administrative kategorien.
   */
  outline: () => Promise<FeatureCollection>
  categories: Category[]
}

/**
 * Trekk ut spill-features fra en rå GeoJSON FeatureCollection.
 *
 * Stedsnavn er ikke egennavn på tvers av språk — Tyskland/Germany,
 * Donau/Danube. Datasettene bærer derfor `name` (norsk) og valgfritt
 * `nameEn`. Visningen følger språkvalget, mens `aliases` holder alle kjente
 * skrivemåter så skrivemodus godtar begge: ingen skal miste poeng på å svare
 * riktig på «feil» språk.
 */
export function toQuizFeatures(fc: FeatureCollection, lang = 'no'): QuizFeature[] {
  const preferEnglish = lang.startsWith('en')
  return fc.features.map((f) => {
    const no = String(f.properties?.name ?? '')
    const en = f.properties?.nameEn ? String(f.properties.nameEn) : ''
    return {
      id: String(f.properties?.id ?? f.id),
      name: preferEnglish && en ? en : no,
      aliases: en && en !== no ? [no, en] : [no],
      geometry: f.geometry,
    }
  })
}
