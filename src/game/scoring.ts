import { PACE_META, type Mode, type Pace } from './types'

/**
 * Poengreglene, samlet på ett sted.
 *
 * De lå spredt som tall midt i reduseren før — 100 her, 60 der, 0.1 i
 * en tredje funksjon — og serveren hadde sin egen kopi av de samme tallene i
 * en kommentar som sa «må speile». En regel som står to steder er en regel
 * som før eller senere bare står halvt.
 *
 * MERK — `functions/api/leaderboard/index.js` kjører i Cloudflare-runtime og
 * kan ikke importere TypeScript herfra. Den holder derfor fortsatt sin egen
 * kopi, men bare av taket den trenger for å avvise umulige poengsummer, og
 * `SCORING_VERSION` under er nummeret som holder de to i lås.
 */

/** Grunnpoeng for ett riktig svar, før modus, combo, fart og tempo. */
export const BASE_POINTS = 100

/** Svar under dette er «lynraskt» og «raskt», i millisekund. */
export const FAST_ANSWER_MS = 2000
export const BRISK_ANSWER_MS = 5000

/** Fartsbonusen som følger de to tersklene. */
export const FAST_BONUS = 60
export const BRISK_BONUS = 30

/** Combo topper etter ti riktige på rad. */
export const MAX_COMBO_STEPS = 10
/** Hver riktige på rad legger på så mye. Ti steg gir ×2. */
export const COMBO_STEP = 0.1

/**
 * Hva modusen er verdt.
 *
 * Å skrive navnet er ikke samme oppgave som å klikke det. I flervalg står
 * svaret på skjermen og du har én av fire i rent hell; i klikkemodus har du
 * navnet og skal finne stedet; i skrivemodus har du verken navnet eller
 * alternativene, og må kunne staveformen òg. Verdien følger det.
 *
 * De samme tallene er derfor òg vanskegraden som står på modusvalget — en rad
 * med tre staver som sier det samme som multiplikatoren.
 */
export const MODE_MULTIPLIER: Record<Mode, number> = {
  choice: 0.8,
  click: 1,
  type: 1.5,
  // flaggmodusene: ett av fire alternativer, samme innsats som flervalg
  flag: 0.8,
  pick: 0.8,
}

/**
 * Trekk for ett bomskudd, før modus og tempo.
 *
 * Straffen finnes fordi et bommet sted kommer tilbake i køen og kan svares
 * riktig senere for full pott. Uten et trekk koster det ingenting å gjette
 * seg fram, og runden blir et spørsmål om tålmod i stedet for kunnskap.
 * Trekket er med vilje under en femdel av det et treff gir: det skal
 * merkes, ikke straffe den som prøver.
 */
export const MISS_PENALTY = 20

/**
 * Hvor mange bom på samme sted spillet tåler før det gir stedet opp for deg.
 *
 * Uten et tak kunne en runde vare evig — stedet kommer tilbake i køen hver
 * gang. Etter tredje bomskuddet blir svaret avslørt for godt og køen går
 * videre.
 */
export const MAX_ATTEMPTS = 3

/**
 * Hvor langt bak i køen et bommet sted blir lagt.
 *
 * For nært, og du husker bare svaret du nettopp så. For langt, og du har
 * glemt at du bommet. Tre spørsmål er langt nok til at det er kunnskap som
 * svarer neste gang.
 */
export const REQUEUE_GAP = 3

/**
 * Nummer på poengreglane.
 *
 * Resultat regnet etter ulike regler kan ikke sammenlignes. Nummeret følger
 * med hver innsending til ledertavla, så eldre rader kan skilles fra nye i
 * stedet for å bli rangert mot dem.
 *
 * 1 — før modusene fikk hver sin verdi. Alle tre modusene ga samme poeng.
 * 2 — MODE_MULTIPLIER og MISS_PENALTY.
 */
export const SCORING_VERSION = 2

/** Combo-multiplikator: ×1,1 på første riktige, ×2 fra ti på rad. */
export function comboMultiplier(streak: number): number {
  return 1 + Math.min(streak, MAX_COMBO_STEPS) * COMBO_STEP
}

/** Fartsbonusen for ett svar. */
export function speedBonus(thinkMs: number): number {
  if (thinkMs < FAST_ANSWER_MS) return FAST_BONUS
  if (thinkMs < BRISK_ANSWER_MS) return BRISK_BONUS
  return 0
}

export interface HitInput {
  mode: Mode
  pace: Pace
  /** rekka *etter* dette svaret */
  streak: number
  /** hvor lenge spørsmålet stod ubesvart */
  thinkMs: number
}

/**
 * Poeng for ett riktig svar.
 *
 * Grunnpoeng pluss fartsbonus, ganget med combo, modus og tempo. Et lynraskt
 * svar midt i en lang rekke i skrivemodus på lynraskt tempo er verdt over ti
 * ganger et sent, ensligt svar i flervalg på rolig.
 */
export function pointsForHit({ mode, pace, streak, thinkMs }: HitInput): number {
  return Math.round(
    (BASE_POINTS + speedBonus(thinkMs)) *
      comboMultiplier(streak) *
      MODE_MULTIPLIER[mode] *
      PACE_META[pace].multiplier,
  )
}

/**
 * Trekk for ett bomskudd.
 *
 * De samme modus- og tempofaktorene som treffet: er runden verdt mer, koster
 * bommen mer. Den som ringer med poengsummen må aldri kunne komme under null
 * — det er kallerens ansvar å klemme summen.
 */
export function penaltyForMiss(mode: Mode, pace: Pace): number {
  return Math.round(MISS_PENALTY * MODE_MULTIPLIER[mode] * PACE_META[pace].multiplier)
}

/**
 * Det høyeste ett eneste sted kan gi.
 *
 * Poengsummen blir regnet ut i nettleseren og kan derfor ikke stoles blindt
 * på. Serveren bruker dette taket ganget med antallet steder til å avvise det
 * som ikke kan ha skjedd i et ekte spill.
 */
export function maxPointsPerTarget(mode: Mode, pace: Pace): number {
  return Math.ceil(
    (BASE_POINTS + FAST_BONUS) *
      comboMultiplier(MAX_COMBO_STEPS) *
      MODE_MULTIPLIER[mode] *
      PACE_META[pace].multiplier,
  )
}
