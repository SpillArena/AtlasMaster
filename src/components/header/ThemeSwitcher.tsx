import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../hooks/useTheme'

function MoonIcon({ active }: { active: boolean }) {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="block"
      animate={{ color: active ? '#1e1b4b' : '#a5b4fc' }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <motion.g
        animate={{
          scale: active ? 1 : 0.96,
          opacity: active ? 1 : 0.9,
        }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{ originX: '50%', originY: '50%' }}
      >
        <path
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
          fill="currentColor"
        />
      </motion.g>

      <motion.circle
        cx="19"
        cy="4"
        r="1"
        fill="#f0abfc"
        animate={{ opacity: active ? 0 : 1, scale: active ? 0.6 : 1 }}
        transition={{ duration: 0.2 }}
        style={{ originX: '50%', originY: '50%' }}
      />
      <motion.circle
        cx="22"
        cy="7"
        r="0.75"
        fill="#f0abfc"
        animate={{ opacity: active ? 0 : 1, scale: active ? 0.6 : 1 }}
        transition={{ duration: 0.2, delay: 0.03 }}
        style={{ originX: '50%', originY: '50%' }}
      />
      <motion.circle
        cx="20.5"
        cy="2"
        r="0.5"
        fill="#e879f9"
        animate={{ opacity: active ? 0 : 1, scale: active ? 0.6 : 1 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        style={{ originX: '50%', originY: '50%' }}
      />
    </motion.svg>
  )
}

function SunIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="block">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <motion.line
          key={angle}
          x1={12 + 6 * Math.cos((angle * Math.PI) / 180)}
          y1={12 + 6 * Math.sin((angle * Math.PI) / 180)}
          x2={12 + 9.5 * Math.cos((angle * Math.PI) / 180)}
          y2={12 + 9.5 * Math.sin((angle * Math.PI) / 180)}
          stroke={active ? '#78350f' : '#fbbf24'}
          strokeWidth="2"
          strokeLinecap="round"
          animate={{
            opacity: active ? 1 : 0.45,
            scale: active ? 1 : 0.9,
          }}
          transition={{ duration: 0.2, delay: i * 0.01 }}
          style={{ originX: '50%', originY: '50%' }}
        />
      ))}
      <motion.circle
        cx="12"
        cy="12"
        r="4.5"
        fill="#fde68a"
        stroke={active ? '#78350f' : '#f59e0b'}
        strokeWidth="1.5"
        animate={{ scale: active ? 1 : 0.92 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{ originX: '50%', originY: '50%' }}
      />
    </svg>
  )
}

export default function ThemeSwitcher() {
  const { t } = useTranslation()
  const { isDark, toggleTheme } = useTheme()

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      title={isDark ? t('themeSwitcher.light') : t('themeSwitcher.dark')}
      aria-label={isDark ? t('themeSwitcher.light') : t('themeSwitcher.dark')}
      className="relative inline-grid h-10 w-[84px] grid-cols-2 items-center rounded-full p-1 cursor-pointer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <motion.div
        className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full"
        animate={{ x: isDark ? 4 : 40 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(99,102,241,0.45))'
            : 'linear-gradient(135deg, rgba(245,158,11,0.35), rgba(251,146,60,0.45))',
        }}
      />

      <span className="relative z-10 flex h-8 w-8 items-center justify-center place-self-center">
        <MoonIcon active={isDark} />
      </span>

      <span className="relative z-10 flex h-8 w-8 items-center justify-center place-self-center">
        <SunIcon active={!isDark} />
      </span>
    </motion.button>
  )
}