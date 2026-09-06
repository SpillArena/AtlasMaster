import { memo } from 'react'
import { flagFor, type EmblemSet, type FlagSpec } from '../../game/flags'
import { flagImageFor } from '../../game/worldFlags'

/**
 * Flagget til et land, tegnet som SVG fra beskrivelsen i game/flags.ts.
 *
 * Duken er 30×20 enheter — 3:2, forholdet de fleste europeiske flagg har.
 * De som egentlig har et annet forhold (Sveits er kvadratisk, Danmark er
 * bredere) blir strukket inn i det samme: et merke på under to centimeter skal
 * leses, ikke måles.
 *
 * Flagget er `aria-hidden`. Det står alltid ved siden av navnet det hører
 * til, og en skjermleser som leser «Norge, flagg til Norge» har fått hjelp av
 * ingen. Mangler flagget, blir det ingenting — navnet står der uansett.
 */
export const FlagBadge = memo(function FlagBadge({
  set,
  featureId,
  className = 'h-4 w-6',
}: {
  set: EmblemSet
  featureId: string
  className?: string
}) {
  // Verden bruker et bildesett — de andre settene tegnes fra geometri under.
  if (set === 'world') {
    const src = flagImageFor(featureId)
    if (!src) return null
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        className={`${className} shrink-0 rounded-[2px] object-cover`}
        style={{ boxShadow: '0 0 0 1px var(--border)' }}
      />
    )
  }

  const spec = flagFor(set, featureId)
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
    case 'texas':
      return (
        <>
          <rect width={30} height={20} fill="#ffffff" />
          <rect y={10} width={30} height={10} fill="#bf0a30" />
          <rect width={10} height={20} fill="#002868" />
          <Star cx={5} cy={10} r={3.6} fill="#ffffff" />
        </>
      )
    case 'alabama':
      return (
        <>
          <rect width={30} height={20} fill="#ffffff" />
          <path d="M0,0 L30,20 M30,0 L0,20" stroke="#bf0a30" strokeWidth={3.4} />
        </>
      )
    case 'alaska':
      return <Alaska />
    case 'hawaii':
      return <Hawaii />
    case 'colorado':
      return <Colorado />
    case 'arizona':
      return <Arizona />
    case 'newMexico':
      return <NewMexico />
  }
}

/**
 * En femtakket stjerne.
 *
 * Ti punkt annenhver gang på en ytre og en indre sirkel, med det første rett
 * opp. Den indre radien er den som avgjør om den ser ut som en stjerne eller
 * som en blomst; 0,382 er forholdet i et regulært pentagram.
 */
function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.382
    const angle = (Math.PI / 5) * i - Math.PI / 2
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`
  })
  return <polygon points={points.join(' ')} fill={fill} />
}

/** Karlsvogna og Polarstjerna i gull på mørkeblått. */
function Alaska() {
  const gold = '#ffb612'
  // fire i skuffa, tre i skaftet, og Polarstjerna alene oppe til høyre
  const dipper = [
    [7.4, 15.4],
    [10.9, 15.9],
    [11.5, 12.6],
    [8, 12.1],
    [14.6, 11.9],
    [17.6, 10.6],
    [20.2, 8.6],
  ]
  return (
    <>
      <rect width={30} height={20} fill="#0f204b" />
      {dipper.map(([cx, cy]) => (
        <Star key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.35} fill={gold} />
      ))}
      <Star cx={25.2} cy={4.6} r={1.7} fill={gold} />
    </>
  )
}

/** Union Jack i øvre hjørne, og åtte striper for dei åtte hovudøyane. */
function Hawaii() {
  const stripes = ['#ffffff', '#c8102e', '#012169']
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} y={i * 2.5} width={30} height={2.5} fill={stripes[i % 3]} />
      ))}
      <svg x={0} y={0} width={15} height={10} viewBox="0 0 30 20">
        <Union />
      </svg>
    </>
  )
}

/** Tre band, en rød C og en gull skive. */
function Colorado() {
  return (
    <>
      <rect width={30} height={20} fill="#002868" />
      <rect y={20 / 3} width={30} height={20 / 3} fill="#ffffff" />
      {/* C-en er en oppklipt sirkel — åpningen vender mot fly-siden */}
      <path
        d="M13.6,5.6 A5.2,5.2 0 1 0 13.6,14.4"
        fill="none"
        stroke="#bf0a30"
        strokeWidth={2.6}
      />
      <circle cx={10.4} cy={10} r={2.7} fill="#ffd700" />
    </>
  )
}

/**
 * Tretten stråler over, blått under, og en kobberstjerne i midten.
 *
 * Strålene får lov til å gå ut over duken — SVG-viewporten klipper dem — og
 * det blå feltet blir tegnet oppå og skjærer dem av på midtlinja.
 */
function Arizona() {
  const rays = Array.from({ length: 13 }, (_, i) => {
    const from = Math.PI + (Math.PI * i) / 13
    const to = Math.PI + (Math.PI * (i + 1)) / 13
    const R = 34
    return {
      i,
      fill: i % 2 === 0 ? '#ce1126' : '#ffc72c',
      points: `15,10 ${15 + R * Math.cos(from)},${10 + R * Math.sin(from)} ${
        15 + R * Math.cos(to)
      },${10 + R * Math.sin(to)}`,
    }
  })
  return (
    <>
      <rect width={30} height={20} fill="#ffc72c" />
      {rays.map((r) => (
        <polygon key={r.i} points={r.points} fill={r.fill} />
      ))}
      <rect y={10} width={30} height={10} fill="#002868" />
      <Star cx={15} cy={10} r={3.6} fill="#b87333" />
    </>
  )
}

/** Zia-soltegnet: en skive og fire grupper på fire stråler. */
function NewMexico() {
  const red = '#c8102e'
  // avstand fra senterlinja, og lengde, for hver av de fire i en gruppe
  const offsets = [-1.7, -0.6, 0.6, 1.7]
  const lengths = [2.6, 3.6, 3.6, 2.6]
  const groups = [0, 90, 180, 270]
  return (
    <>
      <rect width={30} height={20} fill="#ffd700" />
      <circle cx={15} cy={10} r={2.4} fill="none" stroke={red} strokeWidth={1.3} />
      {groups.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 15 10)`}>
          {offsets.map((off, i) => (
            <rect
              key={off}
              x={15 + off - 0.35}
              y={10 - 4.2 - lengths[i]}
              width={0.7}
              height={lengths[i]}
              fill={red}
            />
          ))}
        </g>
      ))}
    </>
  )
}

/** Like eller vektede bånd, på tvers eller på langs. */
function Bands({ spec }: { spec: Extract<FlagSpec, { kind: 'bands' }> }) {
  const weights = spec.weights ?? spec.colors.map(() => 1)
  const total = weights.reduce((n, w) => n + w, 0)
  const span = spec.dir === 'h' ? 20 : 30

  // start og størrelse per bånd, regnet ut før tegningen
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
 * Nordisk kors: loddrett arm forskjøvet mot stanga, vannrett arm midt på.
 * En valgfri, smalere stripe ligger oppå — det er den som skiller Norge fra
 * Danmark og Island fra Finland.
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

/** Ni striper, og et hvitt kors i et blått felt ved stanga. */
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

/** Tre bånd, med sjakkbrettet som skiller flagget fra det nederlandske. */
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
 * De røde diagonalene er i virkeligheten forskjøvet mot hverandre om senterlinja —
 * det er den detaljen som skiller et rett union-flagg fra et opp-ned. På seks
 * millimeter er forskjellen en tidels piksel, så de står symmetrisk her.
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
