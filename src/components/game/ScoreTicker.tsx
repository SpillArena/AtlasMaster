import { useEffect, useRef, useState } from 'react'
import { useGameSettings } from '../../contexts/useGameSettings'

interface Props {
  value: number
  className?: string
}

const DURATION = 420

/**
 * Poengsummen ruller opp til ny verdi i stedet for å hoppe. Tallet er det
 * eneste på skjermen som beveger seg av seg selv, så det trekker blikket når
 * det endrer seg.
 *
 * «Mindre bevegelse» hopper rett til tallet. Appen har tre lag som slår av
 * bevegelse — mediespørringen, `.reduce-motion`-klassen og `MotionConfig` —
 * og denne tellinga slapp gjennom alle tre, fordi ingen av dem ser en
 * `requestAnimationFrame`-løkke som skriver React-tilstand.
 */
export function ScoreTicker({ value, className }: Props) {
  const { motion } = useGameSettings()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return
    // ingen løkke i det hele tatt under «mindre bevegelse» — tallet rendres
    // direkte fra `value` under, så det trengs ingen tilstand å sette her
    if (motion === 'reduced') {
      fromRef.current = value
      return
    }
    const start = performance.now()
    let raf = 0

    const step = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION)
      // ease-out: rask start, mykt stopp
      const eased = 1 - (1 - p) ** 3
      const current = Math.round(from + (value - from) * eased)
      setDisplay(current)
      fromRef.current = current
      if (p < 1) raf = requestAnimationFrame(step)
      else fromRef.current = value
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, motion])

  return <span className={className}>{motion === 'reduced' ? value : display}</span>
}
