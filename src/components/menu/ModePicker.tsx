import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MODES, type Category, type Mode } from '../../game/types'
import { MODE_MULTIPLIER } from '../../game/scoring'
import { bestFor } from '../../game/progress'
import { playSfx } from '../../game/sfx'
import { ModeDemo } from './ModeDemo'
import { Icon } from '../Icon'

interface Props {
  regionId: string
  category: Category
  onPick: (mode: Mode) => void
}

/** Hvor krevende modusen er å svare i — 1–3 fylte staver. */
const DIFFICULTY: Record<Mode, number> = {
  choice: 1,
  click: 2,
  type: 3,
}

/**
 * Modusvalget er et valg av kontroll, ikke av innhold — derfor rader med en
 * levende demo av hvordan du svarer, i stedet for enda et rutenett av fliser
 * som ligner kategorivalget rett før.
 */
export function ModePicker({ regionId, category, onPick }: Props) {
  const { t } = useTranslation()

  // 1–3 velger modus, samme tall som står på radene
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const index = Number(event.key) - 1
      if (Number.isNaN(index) || index < 0 || index >= MODES.length) return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      playSfx('ui')
      onPick(MODES[index])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onPick])

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-4 px-4 py-6">
      <div>
        <p className="stat-label mb-1">{t(category.labelKey)}</p>
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
          {t('mode.subtitle')}
        </h2>
      </div>

      <ul className="flex flex-col gap-2.5">
        {MODES.map((mode, i) => {
          const best = bestFor(regionId, category.id, mode)
          const difficulty = DIFFICULTY[mode]
          return (
            <li key={mode}>
              <motion.button
                onClick={() => {
                  playSfx('ui')
                  onPick(mode)
                }}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, type: 'spring', stiffness: 140, damping: 18 }}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.99 }}
                className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border p-3 text-left transition-colors hover:border-[var(--accent)] sm:gap-5 sm:p-4"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                {/* aksentstripe i kanten — vokser når raden er aktiv */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 origin-left scale-y-0 transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100"
                  style={{ background: 'var(--accent)' }}
                />

                {/* demo av hvordan du svarer i denne modusen */}
                <span
                  aria-hidden
                  className="h-16 w-24 shrink-0 rounded-xl p-1 sm:h-20 sm:w-32"
                  style={{ background: 'var(--bg-deep)' }}
                >
                  <ModeDemo mode={mode} />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-lg font-extrabold tracking-[-0.02em] sm:text-xl">
                      {t(`mode.${mode}.title`)}
                    </span>
                    <kbd
                      className="numeric hidden rounded border px-1.5 py-0.5 text-[0.625rem] font-bold sm:inline"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}
                    >
                      {i + 1}
                    </kbd>
                  </span>

                  <span className="text-xs sm:text-sm" style={{ color: 'var(--text-subtle)' }}>
                    {t(`mode.${mode}.desc`)}
                  </span>

                  <span className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="stat-label">{t('mode.difficulty')}</span>
                    <span aria-hidden className="flex gap-1">
                      {[1, 2, 3].map((step) => (
                        <span
                          key={step}
                          className="h-1.5 w-4 rounded-full"
                          style={{
                            background: step <= difficulty ? 'var(--accent)' : 'var(--map-idle)',
                          }}
                        />
                      ))}
                    </span>
                    <span className="sr-only">
                      {t('mode.difficultyLevel', { level: difficulty })}
                    </span>

                    {/*
                      Vanskegrad utan verdi er berre ei åtvaring. Multiplikatoren
                      seier kva den ekstra vanskegraden faktisk er verdt, med
                      same tal som poengmodulen reknar med.
                    */}
                    <span
                      className="numeric rounded-full px-2 py-0.5 text-[0.625rem] font-bold"
                      style={{ background: 'var(--map-idle)', color: 'var(--gold)' }}
                    >
                      ×{MODE_MULTIPLIER[mode]}
                    </span>
                    <span className="sr-only">
                      {t('mode.worth', { multiplier: MODE_MULTIPLIER[mode] })}
                    </span>
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1">
                  {best > 0 && (
                    <span className="flex items-center gap-1">
                      <Icon
                        name="trophy"
                        className="h-3.5 w-3.5"
                        style={{ color: 'var(--gold)' }}
                      />
                      <span className="numeric text-sm font-bold" style={{ color: 'var(--gold)' }}>
                        {best}
                      </span>
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="text-xl transition-transform duration-200 group-hover:translate-x-1"
                    style={{ color: 'var(--text-subtle)' }}
                  >
                    →
                  </span>
                </span>
              </motion.button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
