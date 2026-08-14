import { memo } from 'react'
import { flagFor, type FlagSpec } from '../../game/flags'

/**
 * Flagget til eit land, teikna som SVG frå skildringa i game/flags.ts.
 *
 * Duken er 30×20 einingar — 3:2, forholdet dei fleste europeiske flagg har.
 * Dei som eigentleg har eit anna forhold (Sveits er kvadratisk, Danmark er
 * breiare) blir strekte inn i det same: eit merke på under to centimeter skal
 * lesast, ikkje målast.
 *
 * Flagget er `aria-hidden`. Det står alltid ved sida av namnet det høyrer
 * til, og ein skjermlesar som les «Noreg, flagg til Noreg» har fått hjelp av
 * ingen. Manglar flagget, blir det ingenting — namnet står der uansett.
 */
export const FlagBadge = memo(function FlagBadge({
  featureId,
  className = 'h-4 w-6',
}: {
  featureId: string
  className?: string
}) {
  const spec = flagFor(featureId)
  if (!spec) return null

  return (
    <svg
      viewBox="0 0 30 20"
      className={`${className} shrink-0 rounded-[2px]`}
      aria-hidden
      focusable="false"
      style={{ boxShadow: '0 0 0 1px var(--border)' }}
    >
      <Shapes spec={spec} />
    </svg>
  )
})

function Shapes({ spec }: { spec: FlagSpec }) {
  switch (spec.kind) {
    case 'bands':
      return <Bands spec={spec} />
    case 'nordic':
      return <Nordic spec={spec} />
    case 'cross':
      return (
        <>
          <rect width={30} height={20} fill={spec.field} />
          <rect x={13} y={4} width={4} height={12} fill={spec.cross} />
          <rect x={9} y={8} width={12} height={4} fill={spec.cross} />
        </>
      )
    case 'wedge':
      return (
        <>
          <rect width={30} height={10} fill={spec.top} />
          <rect y={10} width={30} height={10} fill={spec.bottom} />
          <polygon points="0,0 15,10 0,20" fill={spec.wedge} />
        </>
      )
    case 'greece':
      return <Greece />
    case 'croatia':
      return <Croatia />
    case 'union':
      return <Union />
  }
}

/** Like eller vekta band, på tvers eller på langs. */
function Bands({ spec }: { spec: Extract<FlagSpec, { kind: 'bands' }> }) {
  const weights = spec.weights ?? spec.colors.map(() => 1)
  const total = weights.reduce((n, w) => n + w, 0)
  const span = spec.dir === 'h' ? 20 : 30

  // start og storleik per band, rekna ut før teikninga
  const bands = spec.colors.map((color, i) => ({
    color,
    key: `${color}-${i}`,
    offset: (weights.slice(0, i).reduce((n, w) => n + w, 0) / total) * span,
    size: (weights[i] / total) * span,
  }))

  return (
    <>
      {bands.map((b) =>
        spec.dir === 'h' ? (
          <rect key={b.key} y={b.offset} width={30} height={b.size} fill={b.color} />
        ) : (
          <rect key={b.key} x={b.offset} width={b.size} height={20} fill={b.color} />
        ),
      )}
    </>
  )
}

/**
 * Nordisk kors: loddrett arm forskjøve mot stanga, vassrett arm midt på.
 * Ei valfri, smalare stripe ligg oppå — det er den som skil Noreg frå
 * Danmark og Island frå Finland.
 */
function Nordic({ spec }: { spec: Extract<FlagSpec, { kind: 'nordic' }> }) {
  return (
    <>
      <rect width={30} height={20} fill={spec.field} />
      <rect x={9} width={4} height={20} fill={spec.cross} />
      <rect y={8} width={30} height={4} fill={spec.cross} />
      {spec.inner && (
        <>
          <rect x={10} width={2} height={20} fill={spec.inner} />
          <rect y={9} width={30} height={2} fill={spec.inner} />
        </>
      )}
    </>
  )
}

/** Ni striper, og eit kvitt kors i eit blått felt ved stanga. */
function Greece() {
  const blue = '#0d5eaf'
  const stripe = 20 / 9
  return (
    <>
      <rect width={30} height={20} fill="#ffffff" />
      {[0, 2, 4, 6, 8].map((i) => (
        <rect key={i} y={i * stripe} width={30} height={stripe} fill={blue} />
      ))}
      {/* feltet dekkjer fem striper og er kvadratisk */}
      <rect width={stripe * 5} height={stripe * 5} fill={blue} />
      <rect x={stripe * 2} width={stripe} height={stripe * 5} fill="#ffffff" />
      <rect y={stripe * 2} width={stripe * 5} height={stripe} fill="#ffffff" />
    </>
  )
}

/** Tre band, med sjakkbrettet som skil flagget frå det nederlandske. */
function Croatia() {
  const cell = 1.6
  const x0 = 15 - cell * 2.5
  const y0 = 10 - cell * 2.5
  const cells = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if ((row + col) % 2 === 1) continue
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={x0 + col * cell}
          y={y0 + row * cell}
          width={cell}
          height={cell}
          fill="#d81e05"
        />,
      )
    }
  }
  return (
    <>
      <rect width={30} height={20} fill="#ff0000" />
      <rect y={20 / 3} width={30} height={20 / 3} fill="#ffffff" />
      <rect y={40 / 3} width={30} height={20 / 3} fill="#171796" />
      <rect x={x0} y={y0} width={cell * 5} height={cell * 5} fill="#ffffff" />
      {cells}
    </>
  )
}

/**
 * Union Jack.
 *
 * Dei raude diagonalane er i røynda forskjøvne mot kvarandre om senterlinja —
 * det er den detaljen som skil eit rett union-flagg frå eit opp-ned. På seks
 * millimeter er skilnaden ein tidels piksel, så dei står symmetrisk her.
 */
function Union() {
  const blue = '#012169'
  const red = '#c8102e'
  return (
    <>
      <rect width={30} height={20} fill={blue} />
      {/* diagonalar: kvitt breitt, raudt smalt oppå */}
      <g strokeLinecap="butt">
        <path d="M0,0 L30,20 M30,0 L0,20" stroke="#ffffff" strokeWidth={4} />
        <path d="M0,0 L30,20 M30,0 L0,20" stroke={red} strokeWidth={1.6} />
      </g>
      {/* Georgskorset, kvitt under og raudt oppå */}
      <rect x={12} width={6} height={20} fill="#ffffff" />
      <rect y={7} width={30} height={6} fill="#ffffff" />
      <rect x={13.2} width={3.6} height={20} fill={red} />
      <rect y={8.2} width={30} height={3.6} fill={red} />
    </>
  )
}
