import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { badgeStates, TIER_COLOR } from '../../game/badges'
import { getProgress, levelProgress } from '../../game/progress'
import { getSession } from '../../game/auth'
import { getName } from '../../game/leaderboard'
import { hitRate } from '../../game/rank'
import { getCategory, getRegion, regions } from '../../game/regions'
import { MODES, FLAG_MODES, type Mode } from '../../game/types'
import { Icon } from '../Icon'
import { Button } from '../ui'

interface Props {
  /** åpner innlogging / kontodialogen */
  onAccount: () => void
  onClose: () => void
}

const ALL_MODES: Mode[] = [...MODES, ...FLAG_MODES]

/**
 * Profilen: passet i feltboka.
 *
 * Det som fantes før var en pille i headeren med en initial, et nivåtall og en
 * XP-stripe på ti piksler. Alt spillet visste om en spiller lå lagret —
 * personlig rekord i hver eneste kategori, hvor mange runder, hvor lang den
 * lengste rekka hadde vært — og ingenting av det var mulig å se noe sted.
 * `plays` ble til og med skrevet ved hver runde og aldri lest av noen.
 *
 * Fire deler: seglet med nivået, tallene runden etter runde har lagt igjen,
 * merkesamlingen, og rekordboka. Merkene er utledet av profilen og ikke lagret
 * ved siden av — se game/badges.ts — så et låst merke kan si nøyaktig hvor
 * langt igjen det er i stedet for bare å være et hull.
 */
export function ProfilePanel({ onAccount, onClose }: Props) {
  const { t } = useTranslation()
  const progress = getProgress()
  const session = getSession()
  const name = session?.username ?? getName().trim()
  const { level, into, need, pct } = levelProgress(progress.xp)
  const { stats } = progress

  const accuracy = Math.round(hitRate(stats.totalCorrect, stats.totalMistakes) * 100)
  const badges = badgeStates(progress)
  const earnedCount = badges.filter((b) => b.earned).length

  const favourite = Object.entries(stats.byRegion).sort((a, b) => b[1] - a[1])[0]
  const favouriteLabel = favourite ? t(getRegion(favourite[0])?.labelKey ?? favourite[0]) : '—'

  /* Rekordboka: hver kategori man har spilt, med beste poengsum per modus. */
  const ledger = regions
    .map((region) => ({
      region,
      rows: region.categories
        .map((category) => ({
          category,
          scores: ALL_MODES.map((mode) => ({
            mode,
            score: progress.best[`${region.id}:${category.id}:${mode}`] ?? 0,
          })).filter((s) => s.score > 0),
        }))
        .filter((row) => row.scores.length > 0),
    }))
    .filter((group) => group.rows.length > 0)

  return (
    <div
      className="fixed inset-0 z-[440] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="cartouche my-6 w-full max-w-2xl p-5 sm:p-6"
        style={{ color: 'var(--text)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- seglet: nivået, med XP-ringen rundt --- */}
        <header className="flex items-center gap-4">
          <LevelSeal level={level} pct={pct} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t('profile.eyebrow')}</p>
            <h2
              id="profile-title"
              className="font-display truncate text-2xl font-semibold tracking-[-0.005em]"
            >
              {name || t('nav.setName')}
            </h2>
            <p className="text-caption" style={{ color: 'var(--text-subtle)' }}>
              {session ? t('profile.signedIn') : t('profile.guest')}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onAccount}>
            {session ? t('profile.account') : t('auth.signIn')}
          </Button>
        </header>

        <p className="mt-3 text-caption" style={{ color: 'var(--text-subtle)' }}>
          {t('profile.xpToNext', { into, need })}
        </p>

        {/* --- tallene --- */}
        <section aria-label={t('profile.stats')} className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t('profile.rounds')} value={progress.plays} />
          <Stat label={t('profile.xp')} value={progress.xp} />
          <Stat label={t('result.accuracy')} value={`${accuracy}%`} />
          <Stat label={t('result.bestStreak')} value={stats.bestStreak} />
          <Stat label={t('profile.flawless')} value={stats.flawless} />
          <Stat label={t('profile.favourite')} value={favouriteLabel} />
        </section>

        {/* --- merkesamlingen --- */}
        <section aria-label={t('profile.badges')} className="mt-6">
          <h3 className="stat-label mb-2">
            {t('profile.badges')} · {earnedCount}/{badges.length}
          </h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {badges.map(({ badge, earned, at, of }) => (
              <li
                key={badge.id}
                className="plate flex flex-col items-center gap-1 p-2 text-center"
                /*
                  Sølv og låst-grått ligger nær hverandre, så tonen alene sier
                  ikke hva som er tjent. Et opptjent merke får rammen og bunnen
                  i sin egen farge; et låst er stiplet, som et felt som venter
                  på et stempel.
                */
                style={
                  earned
                    ? {
                        opacity: 1,
                        borderColor: `color-mix(in srgb, ${TIER_COLOR[badge.tier]} 60%, transparent)`,
                        background: `color-mix(in srgb, ${TIER_COLOR[badge.tier]} 8%, var(--color-surface-elevated))`,
                      }
                    : { opacity: 0.6, borderStyle: 'dashed' }
                }
                title={t(`badge.${badge.id}.desc`)}
              >
                <span
                  className={`stamp h-9 w-9 ${earned ? 'stamp-press' : ''}`}
                  style={{ color: earned ? TIER_COLOR[badge.tier] : 'var(--text-subtle)' }}
                >
                  <Icon name={badge.icon} className="h-4 w-4" />
                </span>
                <span className="text-caption font-bold leading-tight">
                  {t(`badge.${badge.id}.title`)}
                </span>
                {/*
                  Et låst merke sier hvor langt igjen det er. Et tomt segl som
                  ikke forteller hva som mangler er bare et hull i samlingen.
                */}
                {!earned && badge.count && (
                  <span className="numeric text-caption" style={{ color: 'var(--text-subtle)' }}>
                    {at}/{of}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* --- rekordboka --- */}
        <section aria-label={t('profile.records')} className="mt-6">
          <h3 className="stat-label mb-2">{t('profile.records')}</h3>
          {ledger.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              {t('profile.noRecords')}
            </p>
          ) : (
            ledger.map(({ region, rows }) => (
              <div key={region.id} className="mb-3">
                <p className="text-caption font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-subtle)' }}>
                  {t(region.labelKey)}
                </p>
                <ul>
                  {rows.map(({ category, scores }) => (
                    <li key={category.id} className="ledger flex items-center gap-2 py-1.5">
                      <Icon
                        name={category.icon}
                        className="h-4 w-4 shrink-0"
                        style={{ color: 'var(--text-subtle)' }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {t(getCategory(region.id, category.id)?.labelKey ?? category.labelKey)}
                      </span>
                      <span className="flex flex-wrap justify-end gap-x-3 gap-y-0.5">
                        {scores.map(({ mode, score }) => (
                          <span key={mode} className="text-caption whitespace-nowrap">
                            <span style={{ color: 'var(--text-subtle)' }}>
                              {t(`mode.${mode}.title`)}{' '}
                            </span>
                            <span className="numeric font-bold" style={{ color: 'var(--gold)' }}>
                              {score}
                            </span>
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <div className="mt-6 flex justify-end">
          <Button size="sm" onClick={onClose}>
            {t('profile.close')}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

/** Nivået som et lakksegl, med XP-en som en ring rundt. */
function LevelSeal({ level, pct }: { level: number; pct: number }) {
  const r = 26
  const circumference = 2 * Math.PI * r
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--map-idle)" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
        />
      </svg>
      <span
        className="stamp absolute inset-[9px] flex items-center justify-center"
        style={{ color: 'var(--brass)' }}
      >
        <span className="numeric text-lg font-bold" style={{ color: 'var(--text)' }}>
          {level}
        </span>
      </span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="plate p-3">
      <p className="stat-label">{label}</p>
      <p className="numeric truncate text-lg font-bold">{value}</p>
    </div>
  )
}
