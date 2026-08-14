import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { GameSettingsContext, type MotionSetting } from './game-settings-context'
import { PACES, type Pace } from '../game/types'
import { setSfxEnabled } from '../game/sfx'
import { readPreference, writePreference } from '../lib/cookieConsent'

function readBool(key: string, fallback: boolean): boolean {
  const stored = readPreference(key)
  return stored === null ? fallback : stored === 'on'
}

function readMotion(): MotionSetting {
  if (readPreference('motion') === 'reduced') return 'reduced'
  if (readPreference('motion') === 'full') return 'full'
  // ingen lagret verdi: følg operativsystemet
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full'
}

function readPace(): Pace {
  const stored = readPreference('pace')
  return PACES.includes(stored as Pace) ? (stored as Pace) : 'normal'
}

export function GameSettingsProvider({ children }: { children: ReactNode }) {
  const [sound, setSound] = useState(() => readBool('sound', true))
  const [motion, setMotion] = useState<MotionSetting>(readMotion)
  const [pace, setPace] = useState<Pace>(readPace)

  useEffect(() => {
    setSfxEnabled(sound)
    writePreference('sound', sound ? 'on' : 'off')
  }, [sound])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', motion === 'reduced')
    writePreference('motion', motion)
  }, [motion])

  useEffect(() => {
    writePreference('pace', pace)
  }, [pace])

  return (
    <GameSettingsContext.Provider
      value={{ sound, motion, pace, setSound, setMotion, setPace }}
    >
      {children}
    </GameSettingsContext.Provider>
  )
}
