interface Props {
  /** millisekunder igjen på spørsmålet */
  remainingMs: number
  /** hele tidsrammen for ett spørsmål */
  totalMs: number
}

/** Radien ringen tegnes med, i SVG-enheter. Omkretsen faller ut av den. */
const R = 20
const CIRCUMFERENCE = 2 * Math.PI * R

/**
 * Kronometeret: klokka for ett spørsmål.
 *
 * Dette var en stripe på halvannen piksel med et fjorten piksels tall ved
 * siden av, i dempet grått, i en rad der to andre striper på halvannen piksel
 * lå rett ved. Tre like hårstreker, og den ene av dem var det eneste i hele
 * skjermbildet som faktisk tikket. På en telefon var hele klokka nittiseks
 * piksler bred.
 *
 * Nå er den et instrument: en skive med en visersirkel som tømmes mot klokka,
 * og sekundene i midten, store nok til å leses i øyekroken mens blikket er på
 * kartet. Formen skiller den fra de to stripene — man teller ikke ned i en
 * fremdriftsindikator.
 *
 * Tre trinn i stedet for to. Rolig over halvtid, messing under, rødt og
 * pulserende de siste tre sekundene — der `playSfx('tick')` uansett går av.
 * Å gå rett fra rolig til rødt ga ingen advarsel før det var for sent å bruke
 * den til noe.
 *
 * Selve tallet står stille, som før: et hopp per sekund gjorde nedtellingen
 * urolig å se på, og det er fargen og ringen som bærer tidspresset.
 */
export function TimerBar({ remainingMs, totalMs }: Props) {
  const left = totalMs ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const seconds = Math.ceil(remainingMs / 1000)
  const urgent = remainingMs <= 3000
  const warning = !urgent && left <= 0.5

  const tone = urgent ? 'var(--danger)' : warning ? 'var(--gold)' : 'var(--info)'

  return (
    <div
      className={`relative h-[52px] w-[52px] shrink-0 ${urgent ? 'chrono-urgent' : ''}`}
      role="timer"
      aria-live="off"
    >
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
        {/* messingkassen rundt skiva */}
        <circle
          cx="24"
          cy="24"
          r={R + 2}
          fill="var(--surface-card)"
          stroke="color-mix(in srgb, var(--brass) 55%, transparent)"
          strokeWidth="1"
        />
        {/* sporet viseren går i */}
        <circle cx="24" cy="24" r={R} fill="none" stroke="var(--map-idle)" strokeWidth="3.5" />
        {/*
          Buen tømmes med `stroke-dashoffset`. Det er maling og ikke layout, så
          nettleseren slipper å regne om flyten ti ganger i sekundet — den
          grunnen stripa før dette brukte `transform` framfor `width`. Ett lite
          element som males om på nytt koster ingenting; en omregnet layout
          koster hele skjermbildet.
        */}
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          stroke={tone}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - left)}
          style={{ transition: 'stroke-dashoffset 120ms linear, stroke 200ms ease' }}
        />
      </svg>
      <span
        aria-hidden
        className="numeric absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums"
        style={{ color: urgent ? 'var(--danger)' : 'var(--text)' }}
      >
        {seconds}
      </span>
    </div>
  )
}
