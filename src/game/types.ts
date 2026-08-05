import type { Geometry, FeatureCollection } from 'geojson'
import type { IconName } from '../components/Icon'

/** Ett spillbart geografi-objekt (fylke, kommune, by, ...). */
export interface QuizFeature {
  id: string
  name: string
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
}

/** Trekk ut spill-features fra en rå GeoJSON FeatureCollection. */
export function toQuizFeatures(fc: FeatureCollection): QuizFeature[] {
  return fc.features.map((f) => ({
    id: String(f.properties?.id ?? f.id),
    name: String(f.properties?.name ?? ''),
    geometry: f.geometry,
  }))
}
