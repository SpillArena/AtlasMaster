import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import type { Mode } from '../game/types'

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
    <div className="border-t border-gray-200 bg-white/95 pt-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-gray-950/95">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4">
        {/* prompt / kontroller */}
        {mode === 'click' ? (
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('hud.findThis')}
            </div>
            <div className="text-3xl font-bold tracking-tight">{targetName}</div>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
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
            className="rounded-lg px-4 py-2 font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            {t('hud.skip')}
          </button>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <button
            onClick={onGiveUp}
            className="rounded-lg px-4 py-2 font-medium text-red-500/90 hover:bg-red-50 hover:text-red-600 dark:text-red-400/90 dark:hover:bg-red-950"
          >
            {t('hud.giveUp')}
          </button>
        </div>
      </div>
    </div>
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
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {choices.map((c, i) => (
        <motion.button
          // targetKey i nøkkel → re-animer ved nytt spørsmål
          key={`${targetKey}-${c.id}`}
          onClick={() => onChoose(c.id)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-3 rounded-2xl border-2 border-sky-300 bg-sky-50 px-4 py-4 text-left text-lg font-semibold text-sky-900 shadow-sm transition-colors hover:border-sky-500 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/70 dark:text-sky-100 dark:hover:border-sky-500 dark:hover:bg-sky-900"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white">
            {i + 1}
          </span>
          {c.name}
        </motion.button>
      ))}
    </div>
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
        className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-sky-400 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-sky-500"
      />
      <button
        type="submit"
        className="rounded-xl bg-sky-500 px-5 py-3 text-base font-medium text-white hover:bg-sky-600"
      >
        {t('hud.submit')}
      </button>
    </form>
  )
}
