import { useEffect, useRef, useState } from 'react'
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

export function GameHUD({
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
    <footer
      className="shrink-0 border-t pt-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      style={{ borderColor: 'var(--border)', background: 'var(--nav-bg)' }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-3 sm:px-4">
        {/* prompt / kontroller */}
        {mode === 'click' ? (
          <div>
            <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              {t('hud.findThis')}
            </div>
            <div className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {targetName}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
              {t('hud.whatIsThis')}
            </div>
            {mode === 'choice' ? (
              <ChoiceButtons
                choices={choices}
                targetKey={targetKey}
                onChoose={onChoose}
              />
            ) : (
              <TypeInput targetKey={targetKey} onType={onType} />
            )}
          </div>
        )}

        {/* sekundære handlinger — ghost, tydelig ulike fra svar-alternativene */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            onClick={onSkip}
            className="rounded-lg px-4 py-2 font-medium transition-colors"
            style={{ color: 'var(--text-subtle)' }}
          >
            {t('hud.skip')}
          </button>
          <span style={{ color: 'var(--border)' }}>·</span>
          <button
            onClick={onGiveUp}
            className="rounded-lg px-4 py-2 font-medium transition-colors"
            style={{ color: 'var(--danger)' }}
          >
            {t('hud.giveUp')}
          </button>
        </div>
      </div>
    </footer>
  )
}

function ChoiceButtons({
  choices,
  targetKey,
  onChoose,
}: {
  choices: Choice[]
  targetKey: string
  onChoose: (id: string) => void
}) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {choices.map((c, i) => (
        <li key={`${targetKey}-${c.id}`}>
          <motion.button
            // targetKey i nøkkel → re-animer ved nytt spørsmål
            onClick={() => onChoose(c.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            className="flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-base font-semibold shadow-sm transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--surface-card)] sm:text-lg"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: 'var(--info)' }}
            >
              {i + 1}
            </span>
            {c.name}
          </motion.button>
        </li>
      ))}
    </ul>
  )
}

function TypeInput({
  targetKey,
  onType,
}: {
  targetKey: string
  onType: (text: string) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  // nullstill når mål endres (ikke auto-fokus → unngå at mobiltastatur spretter opp)
  useEffect(() => {
    setText('')
  }, [targetKey])

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
        className="flex-1 rounded-xl border px-4 py-3 text-base outline-none transition-colors focus:border-[var(--accent)]"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
      />
      <button
        type="submit"
        className="rounded-xl px-5 py-3 text-base font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--info)' }}
      >
        {t('hud.submit')}
      </button>
    </form>
  )
}
