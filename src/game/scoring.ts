import { PACE_META, type Mode, type Pace } from './types'

/**
 * Poengreglane, samla på éin stad.
 *
 * Dei låg spreidde som tal midt i reduseraren før — 100 her, 60 der, 0.1 i
 * ein tredje funksjon — og serveren hadde sin eigen kopi av dei same tala i
 * ein kommentar som sa «må speile». Ei regel som står to stader er ei regel
 * som før eller seinare berre står halvt.
 *
 * MERK — `functions/api/leaderboard/index.js` køyrer i Cloudflare-runtime og
 * kan ikkje importere TypeScript herifrå. Han held difor framleis sin eigen
 * kopi, men berre av taket han treng for å avvise umoglege poengsummar, og
 * `SCORING_VERSION` under er nummeret som held dei to i lås.
 */

/** Grunnpoeng for eitt riktig svar, før modus, combo, fart og tempo. */
export const BASE_POINTS = 100

/** Svar under dette er «lynraskt» og «raskt», i millisekund. */
export const FAST_ANSWER_MS = 2000
export const BRISK_ANSWER_MS = 5000

/** Fartsbonusen som følgjer dei to tersklane. */
export const FAST_BONUS = 60
export const BRISK_BONUS = 30

/** Combo topper etter ti riktige på rad. */
export const MAX_COMBO_STEPS = 10
/** Kvar riktige på rad legg på så mykje. Ti steg gjev ×2. */
export const COMBO_STEP = 0.1

/**
 * Kva modusen er verdt.
 *
 * Å skrive namnet er ikkje same oppgåve som å klikke det. I flervalg står
 * svaret på skjermen og du har éin av fire i reint hell; i klikkemodus har du
 * namnet og skal finne staden; i skrivemodus har du korkje namnet eller
 * alternativa, og må kunne staveforma òg. Verdien følgjer det.
 *
 * Same tala er difor òg vanskegraden som står på modusvalet — ei rad med tre
 * staver som seier det same som multiplikatoren.
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
 * Trekk for eitt bomskot, før modus og tempo.
 *
 * Straffen finst fordi eit bomma sted kjem tilbake i køen og kan svarast
 * riktig seinare for full pott. Utan eit trekk kostar det ingenting å gjette
 * seg fram, og runden blir eit spørsmål om tolmod i staden for kunnskap.
 * Trekket er med vilje under ein femdel av det eit treff gjev: det skal
 * merkast, ikkje straffe den som prøver.
 */
export const MISS_PENALTY = 20

/**
 * Kor mange bom på same stad spelet toler før det gjev staden opp for deg.
 *
 * Utan eit tak kunne ein runde vare evig — staden kjem tilbake i køen kvar
 * gong. Etter tredje bomskotet blir svaret avslørt for godt og køen går
 * vidare.
 */
export const MAX_ATTEMPTS = 3

/**
 * Kor langt bak i køen eit bomma sted blir lagt.
 *
 * For nært, og du hugsar berre svaret du nettopp såg. For langt, og du har
 * gløymt at du bomma. Tre spørsmål er langt nok til at det er kunnskap som
 * svarer neste gong.
 */
export const REQUEUE_GAP = 3

/**
 * Nummer på poengreglane.
 *
 * Resultat rekna etter ulike reglar kan ikkje samanliknast. Nummeret følgjer
 * med kvar innsending til leiartavla, så eldre rader kan skiljast frå nye i
 * staden for å bli rangerte mot dei.
 *
 * 1 — før modusane fekk kvar sin verdi. Alle tre modusane gav same poeng.
 * 2 — MODE_MULTIPLIER og MISS_PENALTY.
 */
export const SCORING_VERSION = 2

/** Combo-multiplikator: ×1,1 på første riktige, ×2 frå ti på rad. */
export function comboMultiplier(streak: number): number {
  return 1 + Math.min(streak, MAX_COMBO_STEPS) * COMBO_STEP
}

/** Fartsbonusen for eitt svar. */
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
  /** kor lenge spørsmålet stod ubesvart */
  thinkMs: number
}

/**
 * Poeng for eitt riktig svar.
 *
 * Grunnpoeng pluss fartsbonus, ganga med combo, modus og tempo. Eit lynraskt
 * svar midt i ei lang rekke i skrivemodus på lynraskt tempo er verdt over ti
 * gonger eit seint, einsleg svar i flervalg på rolig.
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
 * Trekk for eitt bomskot.
 *
 * Same modus- og tempofaktorane som treffet: er runden verdt meir, kostar
 * bommen meir. Den som ringer med poengsummen må aldri kunne kome under null
 * — det er kallaren sitt ansvar å klemme summen.
 */
export function penaltyForMiss(mode: Mode, pace: Pace): number {
  return Math.round(MISS_PENALTY * MODE_MULTIPLIER[mode] * PACE_META[pace].multiplier)
}

/**
 * Det høgste eitt einaste sted kan gje.
 *
 * Poengsummen blir rekna ut i nettlesaren og kan difor ikkje stolast blindt
 * på. Serveren brukar dette taket ganga med talet på stader til å avvise det
 * som ikkje kan ha skjedd i eit ekte spel.
 */
export function maxPointsPerTarget(mode: Mode, pace: Pace): number {
  return Math.ceil(
    (BASE_POINTS + FAST_BONUS) *
      comboMultiplier(MAX_COMBO_STEPS) *
      MODE_MULTIPLIER[mode] *
      PACE_META[pace].multiplier,
  )
}
