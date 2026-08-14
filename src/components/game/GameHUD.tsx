import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import type { Mode } from '../../game/types'

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
  onChoose: (id: string) => void
  onType: (text: string) => void
  onSkip: () => void
  onGiveUp: () => void
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
  onChoose,
  onType,
  onSkip,
  onGiveUp,
}: Props) {
  const { t } = useTranslation()

  return (
    <footer className="shrink-0 px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
      <div className="panel mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl px-3 py-3 sm:px-4">
        {mode === 'click' ? (
          <div>
            <div className="stat-label">{t('hud.findThis')}</div>
            <motion.div
              // nytt mål = ny nøkkel = navnet slår inn på nytt
              key={targetKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="font-display mt-0.5 text-2xl font-extrabold tracking-[-0.03em] sm:text-4xl"
              style={{ color: 'var(--text)' }}
            >
              {targetName}
            </motion.div>
          </div>
        ) : (
          <div>
            <div className="stat-label mb-2">{t('hud.whatIsThis')}</div>
            {mode === 'choice' ? (
              <ChoiceButtons choices={choices} targetKey={targetKey} onChoose={onChoose} />
            ) : (
              // ny nøkkel per mål monterer feltet på nytt, så teksten nullstilles
              <TypeInput key={targetKey} onType={onType} />
            )}
          </div>
        )}

        {/* sekundære handlinger — tydelig ulike fra svar-alternativene */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            onClick={onSkip}
            className="rounded-lg px-4 py-2 font-semibold transition-colors hover:text-[var(--text)]"
            style={{ color: 'var(--text-subtle)' }}
          >
            {t('hud.skip')}
          </button>
          <span aria-hidden style={{ color: 'var(--border)' }}>
            ·
          </span>
          <button
            onClick={onGiveUp}
            className="rounded-lg px-4 py-2 font-semibold transition-colors"
            style={{ color: 'var(--danger)' }}
          >
            {t('hud.giveUp')}
          </button>
        </div>
      </div>
    </footer>
  )
})

function ChoiceButtons({
  choices,
  targetKey,
  onChoose,
}: {
  choices: Choice[]
  targetKey: string
  onChoose: (id: string) => void
}) {
  // tastene 1–4 svarer også — raskere enn å sikte med musa
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const index = Number(event.key) - 1
      if (Number.isNaN(index) || index < 0 || index >= choices.length) return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      onChoose(choices[index].id)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [choices, onChoose])

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {choices.map((c, i) => (
        <li key={`${targetKey}-${c.id}`}>
          <motion.button
            onClick={() => onChoose(c.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            className="flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-base font-bold transition-[transform,border-color,background-color] duration-100 hover:-translate-y-[1px] hover:border-[var(--accent)] hover:bg-[var(--surface-card)] sm:text-lg"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            <span
              aria-hidden
              className="numeric flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: 'var(--map-idle)', color: 'var(--text-subtle)' }}
            >
              {i + 1}
            </span>
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
        className="flex-1 rounded-xl border-2 px-4 py-3 text-base outline-none transition-colors focus:border-[var(--accent)]"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
        }}
      />
      <button
        type="submit"
        className="rounded-xl px-6 py-3 text-base font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: 'var(--accent)' }}
      >
        {t('hud.submit')}
      </button>
    </form>
  )
}
