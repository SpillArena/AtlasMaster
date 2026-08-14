import { useMemo, useReducer } from 'react'
import { init, reducer, type EngineAction, type EngineState } from './quizReducer'
import type { Mode, Pace, QuizFeature } from './types'

export type { Award, EngineAction, EngineState, GuessStatus, Phase } from './quizReducer'

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
      resume: () => rawDispatch({ t: 'CONTINUE' }),
      restart: () => rawDispatch({ t: 'RESTART' }),
    }),
    [],
  )

  const targetId = state.queue[0] ?? null
  const target = targetId ? (features.find((f) => f.id === targetId) ?? null) : null
  const done = state.total - state.queue.length

  return { state, target, done, ...api }
}
