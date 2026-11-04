import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MODES } from '../../game/types'
import { Icon } from '../Icon'
import { MODE_SKIN } from './skins'

/** Tittelen over kartet: hva siden er, i to linjer, og hva man gjør her. */
export function LandingHero() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-end justify-between gap-x-10 gap-y-4 px-4 py-2">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="min-w-0 flex-[1_1_520px] text-[clamp(2.25rem,5vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.035em]"
      >
        {t('menu.heroTitle')}
        <br />
        <span className="text-[var(--color-primary)]">{t('menu.heroAccent')}</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="m-0 flex-[0_1_380px] text-[1.0625rem] leading-relaxed text-[var(--text-muted)]"
      >
        {t('menu.heroBody')}
      </motion.p>
    </div>
  )
}

/**
 * De tre svarmåtene, som informasjon og ikke som valg: modusen velges etter
 * region og kategori. Står her så en ny spiller ser hva en runde er før de
 * har trykket på noe.
 */
export function ModeStrip() {
  const { t } = useTranslation()
  return (
    <ul className="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-4 px-4 sm:grid-cols-3">
      {MODES.map((mode, i) => (
        <motion.li
          key={mode}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.06, type: 'spring', stiffness: 160, damping: 20 }}
          className="flex items-start gap-4 rounded-[24px] p-4 text-white sm:flex-col sm:gap-3 sm:rounded-[28px] sm:p-6"
          style={{ background: MODE_SKIN[mode].color }}
        >
          <Icon name={MODE_SKIN[mode].icon} className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
          <span className="flex min-w-0 flex-col gap-1 sm:gap-3">
            <span className="text-xl font-bold tracking-[-0.01em] sm:text-2xl">{t(`mode.${mode}.title`)}</span>
            <span className="text-sm leading-normal sm:text-[0.9375rem]">{t(`mode.${mode}.desc`)}</span>
          </span>
        </motion.li>
      ))}
    </ul>
  )
}
