import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { NorwayFlag } from './NorwayFlag'

interface Props {
  onClick: () => void
  size?: 'small' | 'large'
}

/**
 * Tittelen. Flagget sitter i en badge som et spillkassett-merke, og
 * ordmerket er satt i display-fonten med negativ sperring — det er dette
 * elementet resten av menyen henger under.
 */
export function Logo({ onClick, size = 'small' }: Props) {
  const { t } = useTranslation()

  if (size === 'small') {
    return (
      <button
        onClick={onClick}
        className="group flex items-center gap-2 transition-transform duration-200 ease-out hover:-translate-y-[1px]"
      >
        <NorwayFlag className="h-5 w-[1.5rem] rounded-[2px]" />
        <span
          className="font-display text-lg font-extrabold tracking-tight"
          style={{ color: 'var(--text)' }}
        >
          {t('menu.title')}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="group mx-auto flex flex-col items-center gap-3 outline-none"
      aria-label={t('menu.title')}
    >
      <motion.div
        className="relative"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        {/* nordlys bak merket — eneste rene dekorasjonen på skjermen */}
        <div
          aria-hidden
          className="absolute -inset-8 rounded-full blur-2xl animate-breathe"
          style={{
            background:
              'radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%)',
          }}
        />
        <div
          className="relative flex items-center gap-3 rounded-2xl border px-4 py-2.5 transition-transform duration-300 group-hover:-translate-y-0.5"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-card)',
            boxShadow: 'inset 0 1px 0 var(--panel-edge)',
          }}
        >
          <NorwayFlag className="h-7 w-[2.4rem] rounded-[3px] shadow-[0_4px_12px_rgba(0,0,0,0.35)] sm:h-9 sm:w-12" />
          <span
            className="font-display text-3xl font-extrabold leading-none tracking-[-0.045em] sm:text-5xl"
            style={{ color: 'var(--text)' }}
          >
            {t('menu.title')}
          </span>
        </div>
      </motion.div>

      <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-xs font-medium sm:text-sm"
        style={{ color: 'var(--text-subtle)' }}
      >
        {t('menu.description')}
      </motion.span>
    </button>
  )
}
