import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../Icon'
import { scoreFor } from '../../game/leaderboard'

interface Props {
  total: number
  /** antall faktisk riktige (oppgitt teller ikke) */
  correctCount: number
  mistakes: number
  elapsedMs: number
  onRetry: () => void
  onMenu: () => void
  onLeaderboard: () => void
}

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

const CONFETTI_COLORS = ['#BA0C2F', '#00205B', '#f59e0b', '#10b981', '#ffffff']

export function ResultScreen({
  total,
  correctCount,
  mistakes,
  elapsedMs,
  onRetry,
  onMenu,
  onLeaderboard,
}: Props) {
  const { t } = useTranslation()
  // treff% = kun faktisk riktige av totalen
  const accuracy = total ? Math.round((correctCount / total) * 100) : 0
  const score = scoreFor(correctCount, total, elapsedMs)
  const allCorrect = correctCount === total
  const stars = allCorrect && mistakes === 0 ? 3 : allCorrect || accuracy >= 75 ? 2 : 1
  const msg = t(`result.msg${stars}`)

  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2.4 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [],
  )

  return (
    <section aria-label={t('result.title')} className="relative h-full w-full overflow-hidden text-center">
      {/* konfetti */}
      {stars >= 2 &&
        confetti.map((c) => (
          <motion.div
            key={c.id}
            className="absolute top-0 rounded-[2px]"
            style={{ left: `${c.left}%`, width: c.size, height: c.size * 1.4, backgroundColor: c.color }}
            initial={{ y: '-10vh', rotate: 0, opacity: 0 }}
            animate={{ y: '85vh', rotate: 360, opacity: [0, 1, 1, 0.7] }}
            transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, ease: 'linear' }}
          />
        ))}

      <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6">
      {/* trofé */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
        className="flex h-24 w-24 items-center justify-center rounded-full shadow-lg sm:h-28 sm:w-28"
        style={{ background: 'color-mix(in srgb, var(--gold) 18%, var(--bg))', color: 'var(--gold)' }}
      >
        <Icon name="trophy" className="h-14 w-14 sm:h-16 sm:w-16" />
      </motion.div>

      {/* stjerner */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.3 + i * 0.15 }}
          >
            <Star filled={i < stars} />
          </motion.div>
        ))}
      </div>

      {/* melding */}
      <div>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl"
        >
          {msg}
        </motion.h2>
        <p className="mt-1" style={{ color: 'var(--text-subtle)' }}>
          {t('result.title')}
        </p>
      </div>

      {/* total score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.55 }}
        className="flex flex-col items-center"
      >
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-subtle)' }}
        >
          {t('result.score')}
        </span>
        <span
          className="font-display bg-clip-text text-5xl font-black tabular-nums text-transparent sm:text-7xl"
          style={{ backgroundImage: 'linear-gradient(135deg, var(--gold), var(--accent))' }}
        >
          {score}
        </span>
      </motion.div>

      {/* statistikk */}
      <motion.dl
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="grid w-full max-w-md grid-cols-3 gap-3"
      >
        <Stat icon="clock" tone="sky" label={t('result.time')} value={fmtTime(elapsedMs)} />
        <Stat icon="check" tone="emerald" label={t('result.accuracy')} value={`${accuracy}%`} />
        <Stat icon="x" tone="red" label={t('result.mistakes')} value={String(mistakes)} />
      </motion.dl>

      {/* knapper */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
      >
        <button
          onClick={onRetry}
          className="flex-1 rounded-2xl px-6 py-4 text-lg font-bold text-white shadow-md transition-transform hover:scale-[1.02]"
          style={{ background: 'var(--success)' }}
        >
          {t('result.retry')}
        </button>
        <button
          onClick={onMenu}
          className="flex-1 rounded-2xl border-2 px-6 py-4 text-lg font-bold transition-colors hover:bg-[var(--surface-card)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          {t('result.menu')}
        </button>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        onClick={onLeaderboard}
        className="flex items-center gap-2 text-sm font-semibold hover:underline"
        style={{ color: 'var(--gold)' }}
      >
        <Icon name="trophy" className="h-4 w-4" />
        {t('result.leaderboard')}
      </motion.button>
      </div>
    </section>
  )
}

const TONE: Record<string, string> = {
  sky: 'var(--info)',
  emerald: 'var(--success)',
  red: 'var(--danger)',
}

function Stat({
  icon,
  tone,
  label,
  value,
}: {
  icon: IconName
  tone: string
  label: string
  value: string
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-2xl border p-3 shadow-sm sm:p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <Icon name={icon} className="h-6 w-6" style={{ color: TONE[tone] }} />
      <dd className="order-1 m-0 font-display text-xl font-bold tabular-nums sm:text-2xl">
        {value}
      </dd>
      <dt className="order-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
        {label}
      </dt>
    </div>
  )
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-10 w-10 sm:h-12 sm:w-12"
      style={{ color: filled ? 'var(--gold)' : 'var(--border)' }}
      fill="currentColor"
      aria-hidden
    >
      <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L8.49 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345z" />
    </svg>
  )
}
