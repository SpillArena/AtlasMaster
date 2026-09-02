import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import type { EmblemSet } from '../../game/flags'
import type { Mode } from '../../game/types'
import { FlagBadge } from './FlagBadge'
import { Button } from '../ui'

interface Choice {
  id: string
  name: string
}

interface Props {
  mode: Mode
  targetName: string
  /** alternativer for choice-modus */
  choices: Choice[]
  /** nøkkel som endres per nytt mål — nullstiller skrive-input */
  targetKey: string
  /**
   * Id-en til det rette svaret medan det blir avslørt etter eit bomskot.
   * null resten av tida. HUD-en held forma si i staden for å byte innhald:
   * ei rad knappar som forsvinn og kjem tilbake ville dratt heile flata opp
   * og ned for kvart bomskot.
   */
  revealId: string | null
  /** hvilket merkesett navnene skal vises med, eller null — se game/flags.ts */
  emblems: EmblemSet | null
  onChoose: (id: string) => void
  onType: (text: string) => void
  onSkip: () => void
  onGiveUp: () => void
  /**
   * Tel opp for kvart bomskot. Ristinga høyrer heime her og ikkje på kartet:
   * kartet er hovudpersonen og skal stå stille, tilbakemeldinga skjer i
   * panelet der svaret blei gjeve.
   */
  flashKey: number
}

/**
 * Memoisert: HUD-en er uendra mellom kvart klokketikk i toppbjelken, og han
 * ber både framer-motion-knappar og eit tekstfelt som ikkje har noko å tene
 * på å bli avstemt ti gonger i sekundet.
 */
export const GameHUD = memo(function GameHUD({
  mode,
  targetName,
  choices,
  targetKey,
  revealId,
  emblems,
  onChoose,
  onType,
  onSkip,
  onGiveUp,
  flashKey,
}: Props) {
  const { t } = useTranslation()
  const revealing = revealId !== null

  /*
   * Klassen må fjernast og leggjast på att med ein reflow imellom for å
   * starte keyframen på nytt; ein ny `key` ville rive ned heile HUD-en —
   * inkludert tekstfeltet spelaren står og skriv i — for kvart bomskot.
   */
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!flashKey) return
    const el = panelRef.current
    if (!el) return
    el.classList.remove('feedback-shake')
    void el.offsetWidth
    el.classList.add('feedback-shake')
  }, [flashKey])

  return (
    <footer className="shrink-0 px-2.5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 sm:px-4">
      <div
        ref={panelRef}
        className={`panel mx-auto flex max-w-6xl rounded-atlas-lg px-3 py-1.5 sm:px-4 sm:py-2 ${mode === 'click' ? 'items-center justify-between gap-2' : 'flex-col gap-1.5'
          }`}
      >
        {mode === 'click' ? (
          <div className="min-w-0 flex-1">
            <div className="stat-label" style={revealing ? { color: 'var(--info)' } : undefined}>
              {revealing ? t('hud.correctAnswer') : t('hud.findThis')}
            </div>
            <motion.div
              // nytt mål = ny nøkkel = navnet slår inn på nytt
              key={targetKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="font-display mt-0.5 flex min-w-0 items-center gap-2 truncate text-lg font-extrabold tracking-[-0.03em] sm:text-2xl"
              style={{ color: revealing ? 'var(--info)' : 'var(--text)' }}
            >
              {/*
                Flagget står ved sida av namnet, ikkje i staden for det. Det
                er ei ekstra kopling å hengje kunnskapen på — og for dei
                landa vi ikkje kan teikne truverdig, står namnet åleine.
              */}
              {emblems && (
                <FlagBadge set={emblems} featureId={targetKey} className="h-6 w-9 sm:h-8 sm:w-12" />
              )}
              <span className="truncate">{targetName}</span>
            </motion.div>
          </div>
        ) : (
          <div>
            <div className="stat-label mb-1.5" style={revealing ? { color: 'var(--info)' } : undefined}>
              {revealing ? t('hud.correctAnswer') : t('hud.whatIsThis')}
            </div>
            {mode === 'choice' ? (
              <ChoiceButtons
                choices={choices}
                targetKey={targetKey}
                revealId={revealId}
                emblems={emblems}
                onChoose={onChoose}
              />
            ) : revealing ? (
              <RevealedName name={targetName} />
            ) : (
              // ny nøkkel per mål monterer feltet på nytt, så teksten nullstilles
              <TypeInput key={targetKey} onType={onType} />
            )}
          </div>
        )}

        {/* sekundære handlinger — tydelig ulike fra svar-alternativene */}
        <div
          className={`flex shrink-0 items-center gap-1 text-xs ${mode === 'click' ? '' : 'justify-center'
            }`}
        >
          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 text-xs"
            onClick={onSkip}
            disabled={revealing}
          >
            {t('hud.skip')}
          </Button>
          <span aria-hidden style={{ color: 'var(--border)' }}>
            ·
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 text-xs"
            onClick={onGiveUp}
            disabled={revealing}
            style={{ color: 'var(--danger)' }}
          >
            {t('hud.giveUp')}
          </Button>
        </div>
      </div>
    </footer>
  )
})

/**
 * Fasitnamnet i skrivemodus, i staden for tekstfeltet.
 *
 * Same høgd og same kant som feltet det byter ut — flata under kartet skal
 * ikkje hoppe fordi du bomma.
 */
function RevealedName({ name }: { name: string }) {
  return (
    <div
      className="rounded-xl border-2 px-3 py-2 text-sm font-bold"
      style={{ borderColor: 'var(--info)', background: 'var(--surface)', color: 'var(--info)' }}
    >
      {name}
    </div>
  )
}

function ChoiceButtons({
  choices,
  targetKey,
  revealId,
  emblems,
  onChoose,
}: {
  choices: Choice[]
  targetKey: string
  revealId: string | null
  /** hvilket merkesett navnene skal vises med, eller null — se game/flags.ts */
  emblems: EmblemSet | null
  onChoose: (id: string) => void
}) {
  // tastene 1–4 svarer også — raskere enn å sikte med musa
  useEffect(() => {
    if (revealId) return
    function handleKey(event: KeyboardEvent) {
      const index = Number(event.key) - 1
      if (Number.isNaN(index) || index < 0 || index >= choices.length) return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      onChoose(choices[index].id)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [choices, revealId, onChoose])

  return (
    <ul
      className={`grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 ${revealId ? 'pointer-events-none' : ''
        }`}
    >
      {choices.map((c, i) => (
        <li key={`${targetKey}-${c.id}`}>
          <motion.button
            onClick={() => onChoose(c.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            className="flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition-[transform,border-color,background-color] duration-100 hover:-translate-y-[1px] hover:border-[var(--accent)] hover:bg-[var(--surface-card)] sm:text-base"
            style={{
              borderColor: revealId === c.id ? 'var(--info)' : 'var(--border)',
              background: 'var(--surface)',
              color: revealId === c.id ? 'var(--info)' : 'var(--text)',
            }}
          >
            <span
              aria-hidden
              className="numeric flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: 'var(--map-idle)', color: 'var(--text-subtle)' }}
            >
              {i + 1}
            </span>
            {emblems && <FlagBadge set={emblems} featureId={c.id} />}
            <span className="min-w-0 truncate">{c.name}</span>
          </motion.button>
        </li>
      ))}
    </ul>
  )
}

function TypeInput({ onType }: { onType: (text: string) => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onType(text)
    setText('')
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        enterKeyHint="go"
        autoComplete="off"
        autoCorrect="off"
        placeholder={t('hud.typePlaceholder')}
        className="flex-1 rounded-xl border-2 px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)]"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
        }}
      />
      <Button type="submit" size="sm" className="px-4 text-sm font-bold">
        {t('hud.submit')}
      </Button>
    </form>
  )
}
