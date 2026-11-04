import type { Mode, Pace } from '../../game/types'
import type { IconName } from '../Icon'

/**
 * Fargen og ikonet hver svarmodus har, likt på forsiden og i modusvalget.
 *
 * Fargene er mørke nok til at hvit tekst står oppå dem i begge temaer
 * (minst 4,5:1), og forskjellige i lyshet, ikke bare i kulør.
 */
export const MODE_SKIN: Record<Mode, { color: string; icon: IconName }> = {
  click: { color: '#c62f3a', icon: 'target' },
  choice: { color: '#2f7d32', icon: 'list' },
  type: { color: '#5a3fd6', icon: 'keyboard' },
  flag: { color: '#0e7490', icon: 'cards' },
  pick: { color: '#b4530a', icon: 'seal' },
}

/** Fargen et valgt tempo-kort fylles med. */
export const PACE_COLOR: Record<Pace, string> = {
  relaxed: '#0f766e',
  normal: '#5a3fd6',
  blitz: '#c62f3a',
}

/**
 * Regionfargene fra forsidekartet. Kategoriskjermen bruker samme farge på
 * regionens eget kart, så man kjenner igjen hvor man trykket.
 */
export const REGION_COLOR: Record<string, string> = {
  norway: '#e0475a',
  northAmerica: '#1f9bb0',
  usa: '#b8479f',
  oceania: '#3f6fd6',
  antarctica: '#8394aa',
  asia: '#d07a1e',
  africa: '#3f9a45',
  southAmerica: '#16a08e',
  europe: '#7458e6',
  world: '#5a6d92',
}
