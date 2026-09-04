import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MODES, type Category, type Mode } from '../../game/types'
import { MODE_MULTIPLIER } from '../../game/scoring'
import { bestFor } from '../../game/progress'
import { playSfx } from '../../game/sfx'
import { ModeDemo } from './ModeDemo'
import { Icon, type IconName } from '../Icon'

interface Props {
  regionId: string
  category: Category
  onPick: (mode: Mode) => void
}

/** Hvor krevende modusen er å svare i — 1–3 fylte pips. */
const DIFFICULTY: Record<Mode, number> = {
  choice: 1,
  click: 2,
  type: 3,
  flag: 1,
  pick: 1,
}

/** Instrumentet du svarer med i hver modus. */
const INSTRUMENT: Record<Mode, IconName> = {
  choice: 'cards',
  click: 'dividers',
  type: 'pen',
  flag: 'cards',
  pick: 'seal',
}

/**
 * Modusvalget er et valg av verktøy, ikke av innhold — derfor en reol med tre
 * instrumenter. Hver rad viser instrumentet, en levende demo av hvordan du
 * svarer, vanskegrad som blekk-pips, og hva runden er verdt.
 */
export function ModePicker({ regionId, category, onPick }: Props) {
  const { t } = useTranslation()

  // kategorien kan overstyre modussettet — flaggkategorien bruker flag/pick
  const modeList = category.modes ?? MODES

  // tallene velger modus, samme tall som står på radene
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const index = Number(event.key) - 1
      if (Number.isNaN(index) || index < 0 || index >= modeList.length) return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      playSfx('ui')
      onPick(modeList[index])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onPick, modeList])

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-4 px-4 py-6">
      <div>
        <p className="eyebrow">{t(category.labelKey)}</p>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.005em] sm:text-3xl">
          {t('mode.subtitle')}
        </h2>
      </div>

      <ul className="flex flex-col gap-3">
        {modeList.map((mode, i) => {
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
                className="plate group relative flex w-full items-center gap-4 overflow-hidden p-3 text-left sm:gap-5 sm:p-4"
              >
                {/* messingstripe i kanten — vokser når raden er aktiv */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 origin-left scale-y-0 transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100"
                  style={{ background: 'var(--brass)' }}
                />

                {/* instrument + demo */}
                <span className="flex shrink-0 flex-col items-center gap-1.5">
                  <span
                    className="stamp h-10 w-10"
                    style={{ color: 'var(--brass)' }}
                  >
                    <Icon name={INSTRUMENT[mode]} className="h-5 w-5" />
                  </span>
                  <span
                    aria-hidden
                    className="h-12 w-20 rounded-md p-1 sm:h-14 sm:w-28"
                    style={{ background: 'var(--bg-deep)' }}
                  >
                    <ModeDemo mode={mode} />
                  </span>
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span
                      className="font-display text-lg font-semibold tracking-[-0.005em] sm:text-xl"
                      style={{ color: 'var(--text)' }}
                    >
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
                          className="h-2 w-2 rounded-full"
                          style={{
                            background: step <= difficulty ? 'var(--brass)' : 'var(--map-idle)',
                          }}
                        />
                      ))}
                    </span>
                    <span className="sr-only">
                      {t('mode.difficultyLevel', { level: difficulty })}
                    </span>

                    <span
                      className="numeric rounded-full px-2 py-0.5 text-[0.625rem] font-bold"
                      style={{
                        background: 'color-mix(in srgb, var(--brass) 14%, transparent)',
                        color: 'var(--brass)',
                      }}
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
                    <span
                      className="stamp h-8 w-8 text-[0.5625rem] font-bold"
                      style={{ color: 'var(--gold)' }}
                    >
                      <span className="numeric">{best}</span>
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
