import type { FeatureCollection } from 'geojson'
import type { Category } from './types'

/**
 * Registry over øvingskategorier. Hver `load` er en dynamisk import slik at
 * datasettene kode-splittes og bare lastes når en kategori velges.
 * Steg 1-2: kun fylker. Resten legges til etter hvert (kommuner, byer, ...).
 */
export const categories: Category[] = [
  {
    id: 'fylker',
    labelKey: 'cat.fylker',
    geom: 'polygon',
    icon: 'map',
    color: '#10b981',
    load: async () =>
      (await import('../data/fylker.json')).default as unknown as FeatureCollection,
  },
  {
    id: 'storbyer',
    labelKey: 'cat.storbyer',
    geom: 'point',
    icon: 'buildings',
    color: '#0ea5e9',
    load: async () =>
      (await import('../data/storbyer.json')).default as unknown as FeatureCollection,
    // fylke-omriss bak by-punktene for kontekst
    base: async () =>
      (await import('../data/fylker.json')).default as unknown as FeatureCollection,
  },
]

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id)
}
