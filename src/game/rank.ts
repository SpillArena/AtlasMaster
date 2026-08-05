/**
 * Rangering av en fullført runde.
 *
 * Merk at treffandel må regnes per forsøk, ikke per sted: et feilsvar fjerner
 * ikke målet, så du kommer alltid til slutt med alle stedene tatt. Det er
 * antallet forsøk det kostet som skiller en god runde fra en gjettedugnad.
 */

export type Rank = 'S' | 'A' | 'B' | 'C' | 'D'

export interface RankInput {
  correctCount: number
  total: number
  mistakes: number
  bestStreak: number
}

/** Andel forsøk som traff, 0–1. */
export function hitRate(correctCount: number, mistakes: number): number {
  const attempts = correctCount + mistakes
  return attempts ? correctCount / attempts : 0
}

export function rankFor({ correctCount, total, mistakes, bestStreak }: RankInput): Rank {
  const rate = hitRate(correctCount, mistakes)
  if (mistakes === 0 && correctCount === total && bestStreak === total) return 'S'
  if (rate >= 0.9) return 'A'
  if (rate >= 0.75) return 'B'
  if (rate >= 0.5) return 'C'
  return 'D'
}

/** Farge per rang, hentet fra temaets tokens. */
export const RANK_COLOR: Record<Rank, string> = {
  S: 'var(--gold)',
  A: 'var(--success)',
  B: 'var(--info)',
  C: 'var(--accent)',
  D: 'var(--text-subtle)',
}
