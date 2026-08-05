import { createContext } from 'react'
import type { Pace } from '../game/types'

export type MotionSetting = 'full' | 'reduced'

export interface GameSettings {
  /** lydeffekter ved riktig, feil, combo og målgang */
  sound: boolean
  /** vibrasjon på mobil ved feil og combo */
  haptics: boolean
  /** 'reduced' skrur av risting, konfetti og pulsering */
  motion: MotionSetting
  /** tempo: hvor lang tid du har per spørsmål, og poengmultiplikator */
  pace: Pace
}

export interface GameSettingsContextValue extends GameSettings {
  setSound: (value: boolean) => void
  setHaptics: (value: boolean) => void
  setMotion: (value: MotionSetting) => void
  setPace: (value: Pace) => void
}

export const GameSettingsContext = createContext<GameSettingsContextValue | null>(null)
