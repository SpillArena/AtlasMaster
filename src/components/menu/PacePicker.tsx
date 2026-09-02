import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { PACES, PACE_META, type Category, type Mode, type Pace } from '../../game/types'
import { bestFor } from '../../game/progress'
import { playSfx } from '../../game/sfx'
import { Icon } from '../Icon'
import { Button } from '../ui'

interface Props {
  regionId: string
  category: Category
  mode: Mode
  /** forrige tempo — forhåndsvalgt, men runden starter først på START */
  initialPace: Pace
  onStart: (pace: Pace) => void
}

/**
 * Siste steg før start. Tempoet velges her, per runde, fordi det avgjør både
 * hvor hardt runden presser og hva den er verdt — det hører hjemme i
 * oppstarten, ikke i en innstillingsmeny du åpner én gang.
 */
export function PacePicker({ regionId, category, mode, initialPace, onStart }: Props) {
  const { t } = useTranslation()
  const [pace, setPace] = useState<Pace>(initialPace)
  const best = bestFor(regionId, category.id, mode)

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-5 px-4 py-6">
      <div className="text-center">
        <p className="eyebrow">
          {t(category.labelKey)} · {t(`mode.${mode}.title`)}
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.005em] sm:text-3xl">
          {t('pace.title')}
        </h2>
      </div>

      <ul role="radiogroup" aria-label={t('pace.title')} className="grid gap-2.5 sm:grid-cols-3">
        {PACES.map((value, i) => {
          const meta = PACE_META[value]
          const selected = pace === value
          return (
            <li key={value}>
              <motion.button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setPace(value)
                  playSfx('ui')
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                // høg demping: utan henne bruker fjæra over 1,3 s på å roe
                // seg, og dette er siste steget før start — han skal svare
                // med ein gong, ikkje duve seg ferdig
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 260, damping: 24 }}
                whileTap={{ scale: 0.98 }}
                className={`plate flex h-full w-full flex-col items-start gap-1 p-4 text-left transition-all ${
                  selected ? '' : 'hover:-translate-y-[1px]'
                }`}
                style={{
                  borderColor: selected ? 'var(--brass)' : 'var(--border)',
                  boxShadow: selected
                    ? '0 0 0 2px var(--brass), var(--shadow-card)'
                    : undefined,
                }}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="font-display text-lg font-semibold tracking-[-0.005em]">
                    {t(`pace.${value}`)}
                  </span>
                  <span
                    className="numeric text-sm font-bold"
                    style={{ color: selected ? 'var(--accent)' : 'var(--text-subtle)' }}
                  >
                    ×{meta.multiplier}
                  </span>
                </span>
                <span
                  className="flex items-center gap-1.5 text-xs font-bold"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  <Icon name="clock" className="h-3.5 w-3.5" />
                  <span className="numeric">
                    {meta.seconds ? t('pace.seconds', { count: meta.seconds }) : t('pace.noClock')}
                  </span>
                </span>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {t(`pace.${value}Desc`)}
                </span>
              </motion.button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col items-center gap-2">
        <Button
          size="lg"
          onClick={() => onStart(pace)}
          className="w-full max-w-sm font-semibold"
        >
          {t('pace.start')}
        </Button>
        {best > 0 && (
          <p className="text-xs font-bold" style={{ color: 'var(--text-subtle)' }}>
            {t('pace.beat', { score: best })}
          </p>
        )}
      </div>
    </div>
  )
}
