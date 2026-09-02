
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../Icon'
import { RANK_COLOR, hitRate, rankFor } from '../../game/rank'
import { levelProgress, type RunResult } from '../../game/progress'
import { useGameSettings } from '../../contexts/useGameSettings'
import { MODE_MULTIPLIER } from '../../game/scoring'
import type { Mode } from '../../game/types'
import { ScoreTicker } from './ScoreTicker'
import { Button } from '../ui'

/** Ett sted runden avdekte at ikke satt. */
export interface MissedItem {
  id: string
  name: string
  /** antall bomskudd på nettopp dette stedet */
  attempts: number
  /** true om spilleren tok det til slutt, false om det ble avslørt */
  solved: boolean
}

interface Props {
  total: number
  /** antall faktisk riktige (oppgitt teller ikke) */
  correctCount: number
  mistakes: number
  bestStreak: number
  score: number
  /** modusen runden ble spilt i — styrer poengmultiplikatoren som vises */
  mode: Mode
  /** stedene som rauk underveis, i den rekkefølgen de røk */
  missed: MissedItem[]
  elapsedMs: number
  /** hva runden gjorde med profilen — null til den er lagret */
  run: RunResult | null
  onRetry: () => void
  onMenu: () => void
  onLeaderboard: () => void
}

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// papirstas: blekk, messing, lakk, feltgrønt, eldet papir
const CONFETTI_COLORS = ['#211f17', '#a9772f', '#c06b2e', '#4f7a4a', '#ede4d1']

/**
 * Konfettien er spredt med en fast hash i stedet for Math.random: like
 * uregelmessig å se på, men stabilt mellom rendringer.
 */
const CONFETTI = Array.from({ length: 24 }, (_, i) => {
  const spread = (n: number) => ((Math.sin((i + 1) * n) + 1) / 2) % 1
  return {
    id: i,
    left: spread(12.9898) * 100,
    delay: spread(78.233) * 2,
    duration: 2.4 + spread(43.532) * 1.6,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + spread(93.989) * 6,
  }
})

export function ResultScreen({
  total,
  correctCount,
  mistakes,
  bestStreak,
  score,
  mode,
  missed,
  elapsedMs,
  run,
  onRetry,
  onMenu,
  onLeaderboard,
}: Props) {
  const { t } = useTranslation()
  const { motion: motionSetting } = useGameSettings()
  // treff% = andel forsøk som satt, ikke andel steder du kom deg gjennom
  const accuracy = Math.round(hitRate(correctCount, mistakes) * 100)
  const rank = rankFor({ correctCount, total, mistakes, bestStreak })
  const celebrate = rank === 'S' || rank === 'A'
  const level = levelProgress(run?.xp ?? 0)

  return (
    <section
      aria-label={t('result.title')}
      className="relative h-full w-full overflow-hidden text-center"
    >
      {celebrate &&
        motionSetting === 'full' &&
        CONFETTI.map((c) => (
          <motion.div
            key={c.id}
            className="absolute top-0 rounded-[2px]"
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 1.4,
              backgroundColor: c.color,
            }}
            initial={{ y: '-10vh', rotate: 0, opacity: 0 }}
            animate={{ y: '85vh', rotate: 360, opacity: [0, 1, 1, 0.7] }}
            transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, ease: 'linear' }}
          />
        ))}

      <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:gap-5 sm:p-6">
        {/* rangstempelet — rundens dom, satt i display-fonten */}
        <motion.div
          initial={{ scale: 2.2, opacity: 0, rotate: -18 }}
          animate={{ scale: 1, opacity: 1, rotate: -6 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          className="stamp h-24 w-24 sm:h-28 sm:w-28"
          style={{ color: RANK_COLOR[rank] }}
        >
          <span
            className="font-display text-6xl font-semibold leading-none sm:text-7xl"
            style={{ color: RANK_COLOR[rank] }}
          >
            {rank}
          </span>
        </motion.div>

        <div>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="font-display text-2xl font-extrabold tracking-[-0.03em] sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            {t(`result.rank.${rank}`)}
          </motion.h2>
          {run?.isRecord && (
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.5 }}
              className="mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]"
              style={{ background: 'var(--gold)', color: '#1a1200' }}
            >
              {t('result.newRecord')}
            </motion.p>
          )}
        </div>

        {/* total poengsum */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.45 }}
          className="flex flex-col items-center"
        >
          <span className="stat-label">{t('result.score')}</span>
          <span style={{ color: 'var(--gold)' }}>
            <ScoreTicker
              value={score}
              className="numeric text-5xl font-bold leading-none sm:text-7xl"
            />
          </span>
          {/* hva modusen var verdt — samme tall som stod på modusvalget */}
          <span className="mt-1 text-xs font-bold" style={{ color: 'var(--text-subtle)' }}>
            {t(`mode.${mode}.title`)} ·{' '}
            <span className="numeric">×{MODE_MULTIPLIER[mode]}</span>
          </span>
        </motion.div>

        {/* statistikk */}
        <motion.dl
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="grid w-full max-w-md grid-cols-2 gap-2.5 sm:grid-cols-4"
        >
          <Stat icon="clock" tone="var(--info)" label={t('result.time')} value={fmtTime(elapsedMs)} />
          <Stat
            icon="check"
            tone="var(--success)"
            label={t('result.accuracy')}
            value={`${accuracy}%`}
          />
          <Stat
            icon="target"
            tone="var(--gold)"
            label={t('result.bestStreak')}
            value={String(bestStreak)}
          />
          <Stat icon="x" tone="var(--danger)" label={t('result.mistakes')} value={String(mistakes)} />
        </motion.dl>

        {/*
          Stedene som røk.
          Runden sier ikke bare hvor godt det gikk, den sier hva du skal øve
          på: navnene som kostet forsøk, i den rekkefølgen de røk. Et sted
          som ble tatt til slutt står dempet, ett som aldri satt står i rødt.
        */}
        {missed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="w-full max-w-md text-left"
          >
            <h3 className="stat-label mb-1.5">
              {t('result.missedTitle', { count: missed.length })}
            </h3>
            <ul className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {missed.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-bold"
                  style={{
                    borderColor: 'var(--border)',
                    color: m.solved ? 'var(--text-muted)' : 'var(--danger)',
                  }}
                >
                  {m.name}
                  {m.attempts > 1 && (
                    <span className="numeric" style={{ color: 'var(--text-subtle)' }}>
                      ×{m.attempts}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* nivå og XP — viser at runden telte for noe utover tavla */}
        {run && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="w-full max-w-md"
          >
            <div className="mb-1 flex items-baseline justify-between text-xs font-bold">
              <span style={{ color: 'var(--gold)' }}>{t('nav.level', { level: level.level })}</span>
              <span className="numeric" style={{ color: 'var(--text-subtle)' }}>
                {level.into} / {level.need} XP
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: 'var(--map-idle)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, var(--accent), var(--gold))' }}
                initial={{ width: 0 }}
                animate={{ width: `${level.pct}%` }}
                transition={{ duration: 0.8, delay: 0.75, ease: 'easeOut' }}
              />
            </div>
            {run.leveledUp && (
              <p className="mt-1.5 text-sm font-bold" style={{ color: 'var(--gold)' }}>
                {t('result.levelUp', { level: run.levelAfter })}
              </p>
            )}
          </motion.div>
        )}

        {/* knapper */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
        >
          <Button size="lg" onClick={onRetry} className="flex-1">
            {t('result.retry')}
          </Button>
          <Button variant="secondary" size="lg" onClick={onMenu} className="flex-1">
            {t('result.menu')}
          </Button>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={onLeaderboard}
          className="flex items-center gap-2 text-sm font-bold hover:underline"
          style={{ color: 'var(--gold)' }}
        >
          <Icon name="trophy" className="h-4 w-4" />
          {t('result.leaderboard')}
        </motion.button>
      </div>
    </section>
  )
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
    <div className="panel flex flex-col items-center gap-1 rounded-2xl p-3">
      <Icon name={icon} className="h-5 w-5" style={{ color: tone }} />
      <dd className="numeric order-1 m-0 text-xl font-bold">{value}</dd>
      <dt className="stat-label order-2">{label}</dt>
    </div>
  )
}
