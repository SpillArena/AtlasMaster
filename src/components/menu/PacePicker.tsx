import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { PACES, PACE_META, type Category, type Mode, type Pace } from '../../game/types'
import { bestFor } from '../../game/progress'
import { playSfx } from '../../game/sfx'
import { Icon } from '../Icon'
import { StepHeader } from './StepHeader'
import { PACE_COLOR } from './skins'
import { MODE_MULTIPLIER } from '../../game/scoring'
import { getRegion } from '../../game/regions'
import { getName } from '../../game/leaderboard'
import { resolveIdentity } from '../../account'

interface Props {
  regionId: string
  category: Category
  mode: Mode
  /** forrige tempo — forhåndsvalgt, men runden starter først på START */
  initialPace: Pace
  onStart: (pace: Pace) => void
  onBack: () => void
}

/**
 * Siste steg før start. Tempoet velges her, per runde, fordi det avgjør både
 * hvor hardt runden presser og hva den er verdt — det hører hjemme i
 * oppstarten, ikke i en innstillingsmeny du åpner én gang.
 */
export function PacePicker({ regionId, category, mode, initialPace, onStart, onBack }: Props) {
  const { t } = useTranslation()
  const [pace, setPace] = useState<Pace>(initialPace)
  const best = bestFor(regionId, category.id, mode)
  const region = getRegion(regionId)
  const clock = (value: Pace) => {
    const seconds = PACE_META[value].seconds
    return seconds ? t('pace.seconds', { count: seconds }) : t('pace.noClock')
  }

  return (
    <div className="w-full">
      <div className="mx-auto flex min-h-full w-full max-w-[1360px] flex-col gap-6 px-4 pt-6 sm:pb-6">
        <StepHeader step={4} title={t('pace.title')} onBack={onBack} backLabel={t(`mode.${mode}.title`)} />

        <div className="flex flex-wrap gap-4">
          <ul
            role="radiogroup"
            aria-label={t('pace.title')}
            className="grid min-w-0 flex-[999_1_560px] grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
          >
            {PACES.map((value, i) => {
              const meta = PACE_META[value]
              const selected = pace === value
              const color = PACE_COLOR[value]
              // hvor mye av en «normal» runde klokka gir: ingen klokke er full stripe
              const share = meta.seconds ? Math.min(1, meta.seconds / 33) : 1
              return (
                <li key={value} className="flex">
                  <motion.button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setPace(value)
                      playSfx('ui')
                    }}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex flex-1 flex-col gap-3 rounded-[24px] border-2 p-4 text-left transition-colors duration-200 sm:min-h-[280px] sm:gap-4 sm:rounded-[28px] sm:p-6 ${
                      selected
                        ? 'border-[var(--color-primary)] text-white'
                        : 'border-[var(--border)] bg-[var(--color-surface-elevated)] hover:border-[var(--border-hover)]'
                    }`}
                    style={selected ? { background: color } : undefined}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span
                        aria-hidden
                        className="grid h-[26px] w-[26px] place-items-center rounded-full border-2 border-current"
                      >
                        {selected && (
                          <motion.span
                            layoutId="pace-dot"
                            className="h-3 w-3 rounded-full bg-[var(--color-primary)]"
                          />
                        )}
                      </span>
                      <span className="numeric text-[1.375rem] font-bold">×{meta.multiplier}</span>
                    </span>
                    <span className="numeric flex items-center gap-2.5 text-sm font-bold">
                      <Icon name="clock" className="h-5 w-5" />
                      {clock(value)}
                    </span>
                    <span
                      aria-hidden
                      className={`h-2.5 w-full overflow-hidden rounded-full ${selected ? 'bg-black/25' : 'bg-[var(--surface-raised)]'}`}
                    >
                      <motion.span
                        className="block h-full rounded-full"
                        initial={false}
                        animate={{ width: `${share * 100}%` }}
                        style={{ background: selected ? '#ffffff' : color }}
                      />
                    </span>
                    <span className="mt-auto flex flex-col gap-1.5">
                      <span className="text-2xl font-bold leading-none tracking-[-0.02em] sm:text-[2rem]">
                        {t(`pace.${value}`)}
                      </span>
                      <span className={`text-[0.9375rem] leading-snug sm:text-base ${selected ? '' : 'text-[var(--text-muted)]'}`}>
                        {t(`pace.${value}Desc`)}
                      </span>
                    </span>
                  </motion.button>
                </li>
              )
            })}
          </ul>

          <aside
            aria-label={t('pace.summary')}
            className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--color-surface-elevated)] p-6"
          >
            <span className="hud-label">{t('pace.summary')}</span>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-base">
              {[
                [t('pace.region'), region ? t(region.labelKey) : ''],
                [t('pace.category'), t(category.labelKey)],
                [t('pace.mode'), `${t(`mode.${mode}.title`)} · ×${MODE_MULTIPLIER[mode]}`],
                [t('pace.pace'), `${t(`pace.${pace}`)} · ×${PACE_META[pace].multiplier}`],
                [t('pace.clock'), clock(pace)],
              ].map(([term, value]) => (
                <div key={term} className="contents">
                  <dt className="text-[var(--text-subtle)]">{term}</dt>
                  <dd className="m-0 text-right font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="numeric flex items-center justify-between border-t border-[var(--border)] pt-3.5 text-[0.8125rem] text-[var(--text-subtle)]">
              <span>{t('region.best').toUpperCase()}</span>
              <span className="font-bold text-[var(--text)]">{best > 0 ? best : t('region.none')}</span>
            </div>
            <motion.button
              type="button"
              onClick={() => onStart(pace)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="mt-auto hidden min-h-14 items-center justify-center gap-2.5 rounded-full bg-[var(--color-primary)] px-6 text-[1.1875rem] font-bold text-[var(--on-accent)] sm:inline-flex"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M7 4.5v15l12-7.5z" />
              </svg>
              {t('pace.start')}
            </motion.button>
            {!resolveIdentity(getName()).name.trim() && (
              <span className="text-center text-sm text-[var(--text-subtle)]">{t('pace.guestHint')}</span>
            )}
          </aside>
        </div>

        {/*
          På en telefon står sammendraget under tre kort, og startknappen havnet
          en hel skjerm ned. Her ligger den fast nederst i stedet, med det valgte
          tempoet på, så den er der uansett hvor man har rullet.
        */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-[var(--border)] bg-[var(--nav-bg)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
          <motion.button
            type="button"
            onClick={() => onStart(pace)}
            whileTap={{ scale: 0.98 }}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full bg-[var(--color-primary)] px-6 text-lg font-bold text-[var(--on-accent)]"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M7 4.5v15l12-7.5z" />
            </svg>
            {t('pace.start')}
            <span className="numeric text-sm font-medium opacity-80">
              · {t(`pace.${pace}`)} ×{PACE_META[pace].multiplier}
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
