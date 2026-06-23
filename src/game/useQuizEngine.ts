import { useMemo, useReducer } from 'react'
import type { Mode, QuizFeature } from './types'

export type GuessStatus = 'correct' | 'revealed'

export interface EngineState {
  phase: 'playing' | 'finished'
  mode: Mode
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
  startedAt: number
  finishedAt: number | null
}

export type EngineAction =
  | { t: 'GUESS'; id: string }
  | { t: 'TYPE'; text: string }
  | { t: 'SKIP' }
  | { t: 'GIVEUP' }
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
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
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

function matchesName(text: string, name: string): boolean {
  const a = normalize(text)
  const b = normalize(name)
  if (!a) return false
  // tillat 1 feil for navn ≥ 5 tegn
  return a === b || (b.length >= 5 && lev(a, b) <= 1)
}

interface InitArg {
  features: QuizFeature[]
  mode: Mode
}

function init({ features, mode }: InitArg): EngineState {
  const queue = shuffle(features.map((f) => f.id))
  return {
    phase: 'playing',
    mode,
    queue,
    status: {},
    choices: mode === 'choice' && queue[0] ? genChoices(queue[0], features) : [],
    flash: null,
    mistakes: 0,
    total: queue.length,
    startedAt: Date.now(),
    finishedAt: null,
  }
}

/** Felles fremrykk: marker nåværende mål og gå til neste. */
function advance(
  state: EngineState,
  features: QuizFeature[],
  resolution: GuessStatus,
): EngineState {
  const target = state.queue[0]
  const queue = state.queue.slice(1)
  const done = queue.length === 0
  return {
    ...state,
    queue,
    status: { ...state.status, [target]: resolution },
    choices:
      state.mode === 'choice' && queue[0] ? genChoices(queue[0], features) : [],
    flash: null,
    phase: done ? 'finished' : 'playing',
    finishedAt: done ? Date.now() : null,
  }
}

function reducer(
  state: EngineState,
  action: EngineAction,
  features: QuizFeature[],
): EngineState {
  if (action.t === 'RESTART') return init({ features, mode: state.mode })
  if (state.phase !== 'playing' || state.queue.length === 0) return state

  const target = state.queue[0]

  switch (action.t) {
    case 'SKIP': {
      // ingen straff — bare betenkningstid; målet legges bakerst
      const [cur, ...rest] = state.queue
      const queue = [...rest, cur]
      return {
        ...state,
        queue,
        choices: state.mode === 'choice' ? genChoices(queue[0], features) : [],
        flash: null,
      }
    }

    case 'GIVEUP':
      // avslør målet, tell som feil, gå videre
      return advance({ ...state, mistakes: state.mistakes + 1 }, features, 'revealed')

    case 'GUESS': {
      if (action.id === target) return advance(state, features, 'correct')
      return {
        ...state,
        mistakes: state.mistakes + 1,
        flash: { id: action.id, n: (state.flash?.n ?? 0) + 1 },
      }
    }

    case 'TYPE': {
      const name = features.find((f) => f.id === target)?.name ?? ''
      if (matchesName(action.text, name)) return advance(state, features, 'correct')
      return {
        ...state,
        mistakes: state.mistakes + 1,
        flash: { id: target, n: (state.flash?.n ?? 0) + 1 },
      }
    }

    default:
      return state
  }
}

export function useQuizEngine(features: QuizFeature[], mode: Mode) {
  const [state, rawDispatch] = useReducer(
    (s: EngineState, a: EngineAction) => reducer(s, a, features),
    { features, mode },
    init,
  )

  const api = useMemo(
    () => ({
      guess: (id: string) => rawDispatch({ t: 'GUESS', id }),
      type: (text: string) => rawDispatch({ t: 'TYPE', text }),
      skip: () => rawDispatch({ t: 'SKIP' }),
      giveUp: () => rawDispatch({ t: 'GIVEUP' }),
      restart: () => rawDispatch({ t: 'RESTART' }),
    }),
    [],
  )

  const targetId = state.queue[0] ?? null
  const target = targetId ? features.find((f) => f.id === targetId) ?? null : null
  const done = state.total - state.queue.length

  return { state, target, done, ...api }
}
