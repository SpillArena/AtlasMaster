import { useMemo, useReducer } from 'react'
import { PACE_META, type Mode, type Pace, type QuizFeature } from './types'

export type GuessStatus = 'correct' | 'revealed'

/** Grunnpoeng per riktig svar, før combo, fart og tempo. */
const BASE_POINTS = 100
/** Combo topper på ×2 etter ti riktige på rad. */
const MAX_COMBO_STEPS = 10

export interface Award {
  /** hvilken feature poengene kom fra — brukes til å plassere popupen på kartet */
  id: string
  points: number
  /** rekka etter dette svaret */
  combo: number
  /** teller som endres per utdeling, så animasjonen kan kjøres på nytt */
  n: number
}

export interface EngineState {
  phase: 'playing' | 'finished'
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

/** Combo-multiplikator: ×1,1 på første riktige, ×2 fra ti på rad. */
export function comboMultiplier(streak: number): number {
  return 1 + Math.min(streak, MAX_COMBO_STEPS) * 0.1
}

/**
 * Poeng for ett riktig svar: grunnpoeng + fartsbonus, ganget med combo og
 * tempo. Svarer du under to sekunder er det verdt over det dobbelte av et
 * tregt svar på samme spørsmål.
 */
function pointsFor(streak: number, thinkMs: number, pace: Pace): number {
  const speedBonus = thinkMs < 2000 ? 60 : thinkMs < 5000 ? 30 : 0
  return Math.round(
    (BASE_POINTS + speedBonus) * comboMultiplier(streak) * PACE_META[pace].multiplier,
  )
}

interface InitArg {
  features: QuizFeature[]
  mode: Mode
  pace: Pace
}

function init({ features, mode, pace }: InitArg): EngineState {
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
  const done = queue.length === 0
  const now = Date.now()
  return {
    ...state,
    queue,
    status: { ...state.status, [target]: resolution },
    choices: state.mode === 'choice' && queue[0] ? genChoices(queue[0], features) : [],
    flash: null,
    award,
    questionStartedAt: now,
    phase: done ? 'finished' : 'playing',
    finishedAt: done ? now : null,
  }
}

/** Riktig svar: øk rekka, del ut poeng og gå videre. */
function scoreHit(state: EngineState, features: QuizFeature[]): EngineState {
  const target = state.queue[0]
  const streak = state.streak + 1
  const points = pointsFor(streak, Date.now() - state.questionStartedAt, state.pace)
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

/** Feil svar: rekka ryker, feilteller opp, blink på det som ble truffet. */
function scoreMiss(state: EngineState, flashId: string): EngineState {
  return {
    ...state,
    mistakes: state.mistakes + 1,
    streak: 0,
    flash: { id: flashId, n: (state.flash?.n ?? 0) + 1 },
  }
}

function reducer(
  state: EngineState,
  action: EngineAction,
  features: QuizFeature[],
): EngineState {
  if (action.t === 'RESTART') return init({ features, mode: state.mode, pace: state.pace })
  if (state.phase !== 'playing' || state.queue.length === 0) return state

  const target = state.queue[0]

  switch (action.t) {
    case 'SKIP': {
      // ingen straff og rekka overlever — men klokka starter på nytt
      const [cur, ...rest] = state.queue
      const queue = [...rest, cur]
      return {
        ...state,
        queue,
        choices: state.mode === 'choice' ? genChoices(queue[0], features) : [],
        flash: null,
        questionStartedAt: Date.now(),
      }
    }

    case 'GIVEUP':
    case 'TIMEOUT':
      // avslør målet, tell som feil, nullstill rekka og gå videre
      return advance(
        { ...state, mistakes: state.mistakes + 1, streak: 0 },
        features,
        'revealed',
        null,
      )

    case 'GUESS':
      return action.id === target ? scoreHit(state, features) : scoreMiss(state, action.id)

    case 'TYPE': {
      const aliases = features.find((f) => f.id === target)?.aliases ?? []
      return matchesName(action.text, aliases)
        ? scoreHit(state, features)
        : scoreMiss(state, target)
    }

    default:
      return state
  }
}

export function useQuizEngine(features: QuizFeature[], mode: Mode, pace: Pace) {
  const [state, rawDispatch] = useReducer(
    (s: EngineState, a: EngineAction) => reducer(s, a, features),
    { features, mode, pace },
    init,
  )

  const api = useMemo(
    () => ({
      guess: (id: string) => rawDispatch({ t: 'GUESS', id }),
      type: (text: string) => rawDispatch({ t: 'TYPE', text }),
      skip: () => rawDispatch({ t: 'SKIP' }),
      giveUp: () => rawDispatch({ t: 'GIVEUP' }),
      timeout: () => rawDispatch({ t: 'TIMEOUT' }),
      restart: () => rawDispatch({ t: 'RESTART' }),
    }),
    [],
  )

  const targetId = state.queue[0] ?? null
  const target = targetId ? features.find((f) => f.id === targetId) ?? null : null
  const done = state.total - state.queue.length

  return { state, target, done, ...api }
}
