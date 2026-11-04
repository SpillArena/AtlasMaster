import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MODES, type Category, type Mode } from '../../game/types'
import { MODE_MULTIPLIER } from '../../game/scoring'
import { bestFor } from '../../game/progress'
import { playSfx } from '../../game/sfx'
import { ModeDemo } from './ModeDemo'
import { StepHeader } from './StepHeader'
import { MODE_SKIN } from './skins'

interface Props {
  regionId: string
  category: Category
  onPick: (mode: Mode) => void
  onBack: () => void
}

/** Hvor krevende modusen er å svare i — 1–3 fylte pips. */
const DIFFICULTY: Record<Mode, number> = {
  choice: 1,
  click: 2,
  type: 3,
  flag: 1,
  pick: 1,
}

/**
 * Modusvalget er et valg av hvordan du svarer, ikke hva — derfor ett stort
 * kort per modus, med en levende demo av svaret, vanskegrad, hva runden er
 * verdt og tasten som velger den.
 */
export function ModePicker({ regionId, category, onPick, onBack }: Props) {
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
    <div className="w-full">
      <div className="mx-auto flex min-h-full w-full max-w-[1360px] flex-col gap-6 px-4 py-6">
        <StepHeader
          step={3}
          title={t('mode.subtitle')}
          onBack={onBack}
          backLabel={t(category.labelKey)}
          hint={modeList.length === 3 ? t('mode.press') : undefined}
        />

        <ul className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          {modeList.map((mode, i) => {
            const best = bestFor(regionId, category.id, mode)
            const difficulty = DIFFICULTY[mode]
            const skin = MODE_SKIN[mode]
            return (
              <motion.li
                key={mode}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 160, damping: 20 }}
                className="flex"
              >
                <motion.button
                  type="button"
                  onClick={() => {
                    playSfx('ui')
                    onPick(mode)
                  }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-1 flex-col gap-3 rounded-[26px] p-4 text-left text-white sm:gap-4 sm:rounded-[32px] sm:p-6"
                  style={{ background: skin.color }}
                >
                  <span className="flex w-full items-center justify-between">
                    <kbd
                      className="numeric rounded-lg bg-white px-2.5 py-1 text-sm font-bold"
                      style={{ color: skin.color }}
                    >
                      {i + 1}
                    </kbd>
                    <span className="numeric rounded-full bg-black/20 px-2.5 py-1.5 text-xs font-bold">
                      {t('mode.worth', { multiplier: MODE_MULTIPLIER[mode] }).toUpperCase()}
                    </span>
                  </span>

                  <span
                    aria-hidden
                    className="block h-24 w-full rounded-[18px] bg-[var(--bg)] p-2 sm:h-40 sm:rounded-[20px] sm:p-3"
                  >
                    <ModeDemo mode={mode} />
                  </span>

                  <span className="flex flex-col gap-1.5">
                    <span className="text-2xl font-bold leading-none tracking-[-0.02em] sm:text-[1.875rem]">
                      {t(`mode.${mode}.title`)}
                    </span>
                    <span className="text-[0.9375rem] leading-snug sm:text-base">{t(`mode.${mode}.desc`)}</span>
                  </span>

                  <span className="numeric mt-auto flex w-full items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2">
                      {t('mode.difficulty').toUpperCase()}
                      <span aria-hidden className="flex gap-1">
                        {[1, 2, 3].map((step) => (
                          <span
                            key={step}
                            className={`h-2.5 w-2.5 rounded-full border-2 border-white ${step <= difficulty ? 'bg-white' : ''}`}
                          />
                        ))}
                      </span>
                      <span className="sr-only">{t('mode.difficultyLevel', { level: difficulty })}</span>
                    </span>
                    <span>
                      {t('mode.best').toUpperCase()} {best > 0 ? best : t('region.none')}
                    </span>
                  </span>
                </motion.button>
              </motion.li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
