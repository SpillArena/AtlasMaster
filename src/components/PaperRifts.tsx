import { memo } from 'react'

/**
 * Rifter i papiret.
 *
 * Kartbladet i bakgrunnen har ligget brettet i en feltbok i mange år, og et
 * ark som har vært brettet like mange ganger røyner til slutt langs bretten.
 * Dette laget er de rissene: en revne er tegnet i tre streker — et mørkt
 * mellomrom der arket har sluppet, en lys leppe på den ene siden der fiberen
 * står opp mot lyset, og en skygge på den andre.
 *
 * Laget er rent pynt, og ligger med vilje bare over de flatene ingen trykker
 * på. Kartet man faktisk spiller på blir aldri rørt: en revne over Malta ville
 * skjult nettopp det landet som var vanskeligst å finne fra før, og et filter
 * over det interaktive laget koster et nytt oppslag hver gang noen panorerer.
 *
 * Geometrien regnes ut én gang når modulen lastes, ikke per rendring. Tallene
 * er tilfeldige, men frøet er fast, så samme rift ligger på samme sted hver
 * gang — det skal se ut som skade på ett bestemt ark, ikke som støy som
 * flytter seg.
 */

/** Liten deterministisk generator — samme frø gir samme ark, hver gang. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/**
 * Én revne, som en brukket linje fra (x1,y1) til (x2,y2).
 *
 * Avviket er størst på midten og null i endene, slik en rift faktisk går: den
 * begynner smalt i en kant, sprer seg, og lukker seg igjen.
 */
function rift(
  rand: () => number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  steps: number,
  wobble: number,
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  // enhetsnormal, så avviket står vinkelrett på riftens retning
  const nx = -dy / len
  const ny = dx / len

  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // sin(πt) er null i begge ender og én på midten
    const amp = Math.sin(Math.PI * t) * wobble * (rand() - 0.5) * 2
    points.push(`${(x1 + dx * t + nx * amp).toFixed(2)},${(y1 + dy * t + ny * amp).toFixed(2)}`)
  }
  return `M${points.join('L')}`
}

const rand = seeded(20260905)

/** Fire rifter: to lange langs brettene, to korte inn fra kantene. */
const RIFTS = [
  rift(rand, -2, 26, 41, 34, 9, 3.2),
  rift(rand, 63, 8, 104, 19, 8, 2.6),
  rift(rand, 78, 96, 92, 58, 7, 2.2),
  rift(rand, -2, 78, 22, 71, 6, 1.8),
]

/**
 * `viewBox` er 0–100 i begge retninger og `preserveAspectRatio` er slått av,
 * så riftene strekker seg med flaten de ligger på. En rift som er strukket er
 * fortsatt en rift; en rift som ligger i et hjørne av et bredt panel og ikke
 * når over, er en strek.
 */
export const PaperRifts = memo(function PaperRifts({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      {RIFTS.map((d, i) => (
        <g key={i}>
          {/* skyggen under kanten — bredest, ligger nederst */}
          <path
            d={d}
            fill="none"
            stroke="var(--tear-shadow)"
            strokeWidth={0.85}
            strokeLinecap="round"
            transform="translate(0.35 0.5)"
          />
          {/* selve mellomrommet */}
          <path d={d} fill="none" stroke="var(--tear-gap)" strokeWidth={0.55} strokeLinecap="round" />
          {/* fiberleppa som fanger lyset */}
          <path
            d={d}
            fill="none"
            stroke="var(--tear-edge)"
            strokeWidth={0.3}
            strokeLinecap="round"
            transform="translate(-0.3 -0.45)"
          />
        </g>
      ))}
    </svg>
  )
})
