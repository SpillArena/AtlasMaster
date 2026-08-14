interface Props {
  /** millisekunder igjen på spørsmålet */
  remainingMs: number
  /** hele tidsrammen for ett spørsmål */
  totalMs: number
}

/**
 * Klokka for ett spørsmål. Fargen går fra aksent til rødt når det haster, så
 * du kan lese tidspresset i øyekroken uten å se på tallet.
 */
export function TimerBar({ remainingMs, totalMs }: Props) {
  const left = totalMs ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const seconds = Math.ceil(remainingMs / 1000)
  const urgent = remainingMs <= 3000

  return (
    <div className="flex items-center gap-2">
      {/*
        Sekunda står stille — fargeskiftet og lyden bær tidspresset. Eit hopp
        per sekund gjorde nedteljinga urolig å sjå på.
      */}
      <span
        className="numeric w-6 shrink-0 text-right text-sm font-bold"
        style={{ color: urgent ? 'var(--danger)' : 'var(--text-subtle)' }}
        role="timer"
        aria-live="off"
      >
        {seconds}
      </span>
      <span
        aria-hidden
        className="h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: 'var(--map-idle)' }}
      >
        {/*
          Stolpen krympar med `transform`, ikkje `width`. Breidde er layout:
          nettlesaren måtte rekna om flyten ti gonger i sekundet, heile runden
          gjennom. Ein skalering blir handtert av kompositoren åleine.
        */}
        <span
          className="block h-full origin-left rounded-full"
          style={{
            width: '100%',
            transform: `scaleX(${left})`,
            background: urgent ? 'var(--danger)' : 'var(--info)',
            transition: 'transform 120ms linear, background 200ms ease',
          }}
        />
      </span>
    </div>
  )
}
