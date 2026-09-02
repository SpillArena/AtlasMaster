import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { AtlasMark } from './AtlasMark'

interface Props {
  onClick: () => void
  size?: 'small' | 'large'
}

/**
 * Tittelen. Merket sitter i en badge som et spillkassett-merke, og
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
        <AtlasMark className="h-6 w-6" />
        <span
          className="font-display text-xl font-semibold tracking-[-0.005em]"
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
          className="plate relative flex items-center gap-3 px-5 py-3 transition-transform duration-300 group-hover:-translate-y-0.5"
        >
          <AtlasMark className="h-9 w-9 sm:h-12 sm:w-12" />
          <span
            className="font-display text-4xl font-semibold leading-none tracking-[-0.01em] sm:text-6xl"
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
        className="eyebrow"
      >
        {t('menu.description')}
      </motion.span>
    </button>
  )
}
