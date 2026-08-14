import { MAX_ATTEMPTS, REQUEUE_GAP, penaltyForMiss, pointsForHit } from './scoring'
import type { Mode, Pace, QuizFeature } from './types'

/**
 * Spelmotoren, utan React.
 *
 * Reduseraren er reine funksjonar av tilstand og handling, og er skild frå
 * kroken med vilje: reglane for kva som skjer når nokon bommar — kva som blir
 * lagt tilbake i køen, kva eit løyst sted får lov til å gjere — er dei
 * viktigaste i spelet, og dei skal kunne køyrast og verifiserast utan ein
 * nettlesar. Sjå scripts/check-engine.mjs.
 */

export type GuessStatus = 'correct' | 'revealed'

export interface Award {
  /** hvilken feature poengene kom fra — brukes til å plassere popupen på kartet */
  id: string
  points: number
  /** rekka etter dette svaret */
  combo: number
  /** teller som endres per utdeling, så animasjonen kan kjøres på nytt */
  n: number
}

/**
 * `reveal` er fasen mellom eit bomskot og neste spørsmål: det rette svaret
 * lyser opp på kartet, og ingenting tek imot klikk før det er over.
 */
export type Phase = 'playing' | 'reveal' | 'finished'

export interface EngineState {
  phase: Phase
  mode: Mode
  pace: Pace
  /** gjenstående mål-id; queue[0] er nåværende mål */
  queue: string[]
  /** id → status (kun 'correct' lagres permanent = grønn) */
  status: Record<string, GuessStatus>
  /** alternativ-id-er for nåværende mål (kun mode==='choice') */
  choices: string[]
  /** transient feil-blink: id + teller for re-animasjon */
  flash: { id: string; n: number } | null
  /** det rette svaret, vist etter eit bomskot */
  reveal: { id: string; n: number } | null
  /** kor mange gonger kvart sted er bomma på */
  attempts: Record<string, number>
  /** stader som er bomma på minst éin gong, i den rekkjefølgja dei rauk */
  missed: string[]
  mistakes: number
  total: number
  /** samlet poengsum så langt */
  points: number
  /** riktige på rad akkurat nå */
  streak: number
  /** lengste rekke i runden */
  bestStreak: number
  /** når nåværende spørsmål ble vist — driver klokke og fartsbonus */
  questionStartedAt: number
  /** siste poengutdeling, for flytende «+120» på kartet */
  award: Award | null
  startedAt: number
  finishedAt: number | null
}

export type EngineAction =
  | { t: 'GUESS'; id: string }
  | { t: 'TYPE'; text: string }
  | { t: 'SKIP' }
  | { t: 'GIVEUP' }
  | { t: 'TIMEOUT' }
  | { t: 'CONTINUE' }
  | { t: 'RESTART' }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 4 alternativer: målet + 3 tilfeldige distraktorer, shufflet. */
function genChoices(targetId: string, features: QuizFeature[]): string[] {
  const others = features.map((f) => f.id).filter((id) => id !== targetId)
  return shuffle([targetId, ...shuffle(others).slice(0, 3)])
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Levenshtein-avstand for slingringsmonn på skriving. */
function lev(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

/** Ett svar er riktig om det treffer én av skrivemåtene til stedet. */
function matchesName(text: string, aliases: string[]): boolean {
  const a = normalize(text)
  if (!a) return false
  return aliases.some((alias) => {
    const b = normalize(alias)
    // tillat 1 feil for navn ≥ 5 tegn
    return a === b || (b.length >= 5 && lev(a, b) <= 1)
  })
}

interface InitArg {
  features: QuizFeature[]
  mode: Mode
  pace: Pace
}

export function init({ features, mode, pace }: InitArg): EngineState {
  const queue = shuffle(features.map((f) => f.id))
  const now = Date.now()
  return {
    phase: 'playing',
    mode,
    pace,
    queue,
    status: {},
    choices: mode === 'choice' && queue[0] ? genChoices(queue[0], features) : [],
    flash: null,
    reveal: null,
    attempts: {},
    missed: [],
    mistakes: 0,
    total: queue.length,
    points: 0,
    streak: 0,
    bestStreak: 0,
    questionStartedAt: now,
    award: null,
    startedAt: now,
    finishedAt: null,
  }
}

/** Felles fremrykk: marker nåværende mål og gå til neste. */
function advance(
  state: EngineState,
  features: QuizFeature[],
  resolution: GuessStatus,
  award: Award | null,
): EngineState {
  const target = state.queue[0]
  const queue = state.queue.slice(1)
  return {
    ...nextQuestion(state, features, queue),
    status: { ...state.status, [target]: resolution },
    award,
  }
}

/**
 * Set opp neste spørsmål frå ein ferdig kø.
 *
 * Køen kan vere tom — då er runden ferdig. Alternativa blir laga på nytt her
 * og berre her, så flervalgsmodus aldri kan bli ståande med alternativa til
 * eit spørsmål som er passert.
 */
function nextQuestion(
  state: EngineState,
  features: QuizFeature[],
  queue: string[],
): EngineState {
  const done = queue.length === 0
  const now = Date.now()
  return {
    ...state,
    queue,
    choices: state.mode === 'choice' && queue[0] ? genChoices(queue[0], features) : [],
    flash: null,
    reveal: null,
    questionStartedAt: now,
    phase: done ? 'finished' : 'playing',
    finishedAt: done ? now : null,
  }
}

/** Riktig svar: øk rekka, del ut poeng og gå videre. */
function scoreHit(state: EngineState, features: QuizFeature[]): EngineState {
  const target = state.queue[0]
  const streak = state.streak + 1
  const points = pointsForHit({
    mode: state.mode,
    pace: state.pace,
    streak,
    thinkMs: Date.now() - state.questionStartedAt,
  })
  return advance(
    {
      ...state,
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      points: state.points + points,
    },
    features,
    'correct',
    { id: target, points, combo: streak, n: (state.award?.n ?? 0) + 1 },
  )
}

/**
 * Feil svar.
 *
 * Rekka ryker, feiltellaren går opp, og poengsummen får eit trekk — men aldri
 * under null; ein spelar skal ikkje kunne ende ei runde i minus.
 *
 * Runden stoppar ikkje her. Spelet går inn i `reveal`: det rette svaret lyser
 * opp på kartet, og først når spelaren har fått sjå det går køen vidare. Det
 * er det Seterra gjer, og det er skilnaden på ein quiz og ei øving — du får
 * vite kva det *var*, ikkje berre at du tok feil.
 */
function scoreMiss(state: EngineState, flashId: string): EngineState {
  const target = state.queue[0]
  return {
    ...state,
    phase: 'reveal',
    mistakes: state.mistakes + 1,
    streak: 0,
    points: Math.max(0, state.points - penaltyForMiss(state.mode, state.pace)),
    attempts: { ...state.attempts, [target]: (state.attempts[target] ?? 0) + 1 },
    missed: state.missed.includes(target) ? state.missed : [...state.missed, target],
    flash: { id: flashId, n: (state.flash?.n ?? 0) + 1 },
    reveal: { id: target, n: (state.reveal?.n ?? 0) + 1 },
  }
}

/**
 * Legg eit bomma sted tilbake i køen, `REQUEUE_GAP` spørsmål fram i tid.
 *
 * Køen kan vere kortare enn det — mot slutten av runden er det kanskje berre
 * eitt sted att — og då hamnar det bakarst.
 */
function requeue(rest: string[], id: string): string[] {
  const at = Math.min(REQUEUE_GAP, rest.length)
  return [...rest.slice(0, at), id, ...rest.slice(at)]
}

/** Avslør målet permanent og gå videre — brukt av «vet ikke» og klokka. */
function giveUpTarget(state: EngineState, features: QuizFeature[]): EngineState {
  const target = state.queue[0]
  return advance(
    {
      ...state,
      mistakes: state.mistakes + 1,
      streak: 0,
      missed: state.missed.includes(target) ? state.missed : [...state.missed, target],
    },
    features,
    'revealed',
    null,
  )
}

export function reducer(
  state: EngineState,
  action: EngineAction,
  features: QuizFeature[],
): EngineState {
  if (action.t === 'RESTART') return init({ features, mode: state.mode, pace: state.pace })
  if (state.phase === 'finished' || state.queue.length === 0) return state

  const target = state.queue[0]

  /*
   * Medan det rette svaret er framme tek spelet berre imot CONTINUE. Klikk på
   * kartet i den luka skal ikkje kunne bli eit nytt bomskot på eit sted som
   * allereie er avslørt.
   */
  if (state.phase === 'reveal') {
    if (action.t !== 'CONTINUE') return state
    const rest = state.queue.slice(1)
    // tredje bomskotet på same stad: spelet gjev han opp for deg
    if ((state.attempts[target] ?? 0) >= MAX_ATTEMPTS) {
      return {
        ...nextQuestion(state, features, rest),
        status: { ...state.status, [target]: 'revealed' },
      }
    }
    return nextQuestion(state, features, requeue(rest, target))
  }

  switch (action.t) {
    case 'SKIP': {
      // ingen straff og rekka overlever — men klokka starter på nytt
      const [cur, ...rest] = state.queue
      return nextQuestion(state, features, [...rest, cur])
    }

    case 'GIVEUP':
    case 'TIMEOUT':
      return giveUpTarget(state, features)

    case 'GUESS':
      /*
       * Eit løyst sted er ute av spelet. Kartet tek det ut av treff-testinga
       * med `pointer-events: none`, men den regelen gjeld berre peikaren:
       * tastatur, hjelpeteknologi og ei framtidig kontrollflate når fram
       * uansett. Regelen om at eit svart sted aldri kan koste poeng høyrer
       * heime her, i motoren, ikkje i eit stilark.
       */
      if (state.status[action.id]) return state
      return action.id === target ? scoreHit(state, features) : scoreMiss(state, action.id)

    case 'TYPE': {
      const aliases = features.find((f) => f.id === target)?.aliases ?? []
      return matchesName(action.text, aliases) ? scoreHit(state, features) : scoreMiss(state, target)
    }

    default:
      return state
  }
}
