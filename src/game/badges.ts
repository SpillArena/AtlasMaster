import type { IconName } from '../components/Icon'
import { levelFromXp, type Progress } from './progress'
import { regions } from './regions'
import { MODES, FLAG_MODES } from './types'

/**
 * Merkene i profilen.
 *
 * Profilen visste tre ting om en spiller: XP, nivå og personlig rekord per
 * kategori. Alle tre er tall som bare vokser, og ingen av dem sier noe om hva
 * slags spiller man er — om man har vært over hele kloden eller bare i Norge,
 * om man tør å skrive navnet i stedet for å klikke, om man noen gang har hatt
 * en runde uten et eneste bomskudd.
 *
 * Et merke er en PÅSTAND OM TILSTANDEN, ikke en post i en logg. Det avledes av
 * profilen hver gang det spørres etter, og lagres aldri. Da kan de to ikke
 * komme i utakt, en ny profil kan ikke bli født med merker den ikke har
 * fortjent, og en gammel profil får med en gang de merkene den alltid har hatt
 * krav på — reglene kan endres uten en migrasjon.
 *
 * `at`/`of` er der for at et ulåst merke skal si hvor langt igjen det er. Et
 * tomt segl som ikke forteller hva som mangler er bare et hull i samlingen.
 */

export type BadgeTier = 'bronze' | 'silver' | 'gold'

export interface Badge {
  id: string
  icon: IconName
  tier: BadgeTier
  /** hvor langt spilleren er kommet — utelatt der merket ikke er en telling */
  count?: (p: Progress) => { at: number; of: number }
  earned: (p: Progress) => boolean
}

/** Et merke som er låst opp ved å nå et tall. */
const counted = (
  id: string,
  icon: IconName,
  tier: BadgeTier,
  of: number,
  at: (p: Progress) => number,
): Badge => ({
  id,
  icon,
  tier,
  count: (p) => ({ at: Math.min(at(p), of), of }),
  earned: (p) => at(p) >= of,
})

const totalCategories = regions.reduce((n, r) => n + r.categories.length, 0)

export const BADGES: Badge[] = [
  // --- å komme i gang ---
  counted('firstRound', 'pin', 'bronze', 1, (p) => p.plays),
  counted('tenRounds', 'list', 'bronze', 10, (p) => p.plays),
  counted('fiftyRounds', 'list', 'silver', 50, (p) => p.plays),
  counted('hundredRounds', 'list', 'gold', 100, (p) => p.plays),

  // --- å bli god ---
  counted('flawless', 'check', 'silver', 1, (p) => p.stats.flawless),
  counted('tenFlawless', 'check', 'gold', 10, (p) => p.stats.flawless),
  counted('topRank', 'trophy', 'silver', 1, (p) => p.stats.topRanks),
  counted('streakTen', 'target', 'bronze', 10, (p) => p.stats.bestStreak),
  counted('streakTwentyFive', 'target', 'silver', 25, (p) => p.stats.bestStreak),
  counted('streakFifty', 'target', 'gold', 50, (p) => p.stats.bestStreak),

  // --- å komme seg rundt ---
  counted('everyRegion', 'globe', 'gold', regions.length, (p) =>
    regions.filter((r) => (p.stats.byRegion[r.id] ?? 0) > 0).length,
  ),
  counted('everyCategory', 'map', 'gold', totalCategories, (p) => p.stats.categoriesPlayed.length),
  {
    id: 'worldTraveller',
    icon: 'anchor',
    tier: 'silver',
    earned: (p) => (p.stats.byRegion.world ?? 0) > 0,
  },

  // --- å velge den vanskelige veien ---
  counted('everyMode', 'cards', 'gold', MODES.length + FLAG_MODES.length, (p) =>
    [...MODES, ...FLAG_MODES].filter((m) => (p.stats.byMode[m] ?? 0) > 0).length,
  ),
  counted('typist', 'keyboard', 'silver', 25, (p) => p.stats.byMode.type ?? 0),
  counted('blitz', 'clock', 'silver', 25, (p) => p.stats.byPace.blitz ?? 0),
  {
    id: 'flagBearer',
    icon: 'seal',
    tier: 'bronze',
    earned: (p) => FLAG_MODES.some((m) => (p.stats.byMode[m] ?? 0) > 0),
  },

  // --- å bli værende ---
  counted('levelFive', 'compass', 'silver', 5, (p) => levelFromXp(p.xp)),
  counted('levelTen', 'compass', 'gold', 10, (p) => levelFromXp(p.xp)),
]

export function earnedBadgeIds(progress: Progress): string[] {
  return BADGES.filter((b) => b.earned(progress)).map((b) => b.id)
}

export interface BadgeState {
  badge: Badge
  earned: boolean
  at: number
  of: number
}

/** Alle merkene, opptjente først, med hvor langt igjen de andre er. */
export function badgeStates(progress: Progress): BadgeState[] {
  return BADGES.map((badge) => {
    const counts = badge.count?.(progress)
    return {
      badge,
      earned: badge.earned(progress),
      at: counts?.at ?? 0,
      of: counts?.of ?? 1,
    }
  })
}

export const TIER_COLOR: Record<BadgeTier, string> = {
  bronze: '#b06a3a',
  silver: '#9a9686',
  gold: 'var(--gold)',
}
