import { useEffect, useState } from 'react'
import { MotionGlobalConfig } from 'framer-motion'
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
  const [motion, setMotion] = useState<MotionSetting>(() => {
    const initial = readMotion()
    // før første maling, så inngangsanimasjonene på første skjerm også står stille
    MotionGlobalConfig.skipAnimations = initial === 'reduced'
    return initial
  })
  const [pace, setPace] = useState<Pace>(readPace)

  useEffect(() => {
    setSfxEnabled(sound)
    writePreference('sound', sound ? 'on' : 'off')
  }, [sound])

  /*
   * «Mindre bevegelse» virker på to lag: CSS-animasjonene via
   * `.reduce-motion`-klassen, og framer-motion via `skipAnimations`.
   *
   * `MotionConfig reducedMotion` i App.tsx er ikke nok alene. Framer leser den
   * når et element monteres, så alt som allerede stod på skjermen da
   * bryteren ble slått på — kartetikettene, flisene, kortene — fortsatte å
   * fjære og gli. Den globale bryteren sjekkes hver gang en animasjon starter,
   * så den virker med en gang, uten å montere skjermen på nytt.
   */
  useEffect(() => {
    MotionGlobalConfig.skipAnimations = motion === 'reduced'
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
