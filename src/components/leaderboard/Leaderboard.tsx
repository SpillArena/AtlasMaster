import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { regions, getRegion } from '../../game/regions'
import { MODES, PACES, PACE_META, type Mode } from '../../game/types'
import { MODE_MULTIPLIER } from '../../game/scoring'
import { getName } from '../../game/leaderboard'
import { LeaderboardRow } from './LeaderboardRow'
import { useBoard, type BoardScope } from './useBoard'
import { Icon } from '../Icon'

interface Props {
  /** regionen spilleren står i — tavla åpner der */
  regionId: string
}

export function Leaderboard({ regionId }: Props) {
  const { t } = useTranslation()
  const [scope, setScope] = useState<BoardScope>('global')
  const [region, setRegion] = useState<string>(regionId)
  const [filter, setFilter] = useState<string>('all')
  const [mode, setMode] = useState<string>('all')
  const [pace, setPace] = useState<string>('all')
  const { entries, loading, offline, failed } = useBoard(scope, {
    regionId: region,
    categoryId: filter,
    mode,
    pace,
  })
  const categories = getRegion(region)?.categories ?? []

  /*
   * Modusene tavla kan filtrere på.
   *
   * Den itererte over `MODES` — de tre kartmodusene — og lot flaggmodusene
   * ligge. `worldFlags` kan bare spilles i dem, så de rundene kunne aldri
   * hentes fram: velger man Verden + Flagg + en av de tre synlige knappene,
   * er svaret garantert tomt, og runder man faktisk hadde spilt fantes bare
   * under «alle». Settet følger nå kategorien, akkurat som modusvelgeren i
   * spillet gjør.
   */
  const availableModes: Mode[] =
    filter === 'all'
      ? [...new Set(categories.flatMap((c) => c.modes ?? MODES))]
      : (categories.find((c) => c.id === filter)?.modes ?? MODES)

  // egen rad: den er der ofte, og var umulig å få øye på
  const me = getName().trim().toLowerCase()
  const myPlace = me ? entries.findIndex((e) => e.name.trim().toLowerCase() === me) : -1

  return (
    <section aria-label={t('leaderboard.title')} className="mx-auto max-w-6xl px-4 py-4">
      <h1 className="text-h2 mb-4 flex items-center gap-2">
        <Icon name="trophy" className="h-6 w-6" style={{ color: 'var(--gold)' }} />
        {t('leaderboard.title')}
      </h1>

      {/* hele verden, eller bare denne enheten */}
      <div
        className="mb-3 inline-flex rounded-full p-1"
        role="tablist"
        aria-label={t('leaderboard.scope')}
        style={{ background: 'var(--map-idle)' }}
      >
        {(['global', 'local'] as BoardScope[]).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={scope === value}
            onClick={() => setScope(value)}
            className="rounded-full px-4 py-1.5 text-sm font-bold transition-colors"
            style={
              scope === value
                ? { background: 'var(--accent)', color: 'var(--color-surface)' }
                : { color: 'var(--text-subtle)' }
            }
          >
            {t(`leaderboard.${value}`)}
          </button>
        ))}
      </div>

      {/* region-filter — kategoriene under følger valget */}
      <nav aria-label={t('leaderboard.region')} className="mb-3 flex flex-wrap gap-2">
        {/*
          Tavla på tvers av alle regioner har alltid ligget i API-et — `region`
          er valgfri der — men ingen skjerm ba noen gang om den.
        */}
        <Chip
          active={region === 'all'}
          onClick={() => {
            setRegion('all')
            setFilter('all')
          }}
        >
          {t('leaderboard.allRegions')}
        </Chip>
        {regions.map((r) => (
          <Chip
            key={r.id}
            active={region === r.id}
            onClick={() => {
              setRegion(r.id)
              // kategoriene er regionspesifikke, så filteret må nullstilles
              setFilter('all')
            }}
          >
            {t(r.labelKey)}
          </Chip>
        ))}
      </nav>

      {/* kategori-filter */}
      <nav aria-label={t('leaderboard.all')} className="mb-4 flex flex-wrap gap-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('leaderboard.all')}
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
            {t(c.labelKey)}
          </Chip>
        ))}
      </nav>

      {/*
        Modus-filter.
        Modusane er ikkje like mykje verdt — å skrive namnet gjev halvannan
        gong det å klikke — så ei blanda tavle rangerer ikkje like øvingar mot
        kvarandre. «Alle» er framleis der for den som vil sjå heile lista, men
        multiplikatoren står på kvar knapp så det er tydeleg kva som skil dei.
      */}
      <nav aria-label={t('leaderboard.mode')} className="mb-4 flex flex-wrap gap-2">
        <Chip active={mode === 'all'} onClick={() => setMode('all')}>
          {t('leaderboard.all')}
        </Chip>
        {availableModes.map((m) => (
          <Chip key={m} active={mode === m} onClick={() => setMode(m)}>
            {t(`mode.${m}.title`)}{' '}
            <span className="numeric opacity-70">×{MODE_MULTIPLIER[m]}</span>
          </Chip>
        ))}
      </nav>

      {/*
        Tempo-filter.
        Tempoet ganger poengsummen med 0,8 i rolig og 1,4 i lyn, men var
        verken filter eller grupperingsnøkkel: en lynrunde ble rangert rett mot
        en rolig runde og vant på multiplikatoren alene. Toppen av enhver tavle
        var lynrunder, og ingen kunne se hvorfor.
      */}
      <nav aria-label={t('leaderboard.pace')} className="mb-4 flex flex-wrap gap-2">
        <Chip active={pace === 'all'} onClick={() => setPace('all')}>
          {t('leaderboard.all')}
        </Chip>
        {PACES.map((p) => (
          <Chip key={p} active={pace === p} onClick={() => setPace(p)}>
            {t(`pace.${p}`)}{' '}
            <span className="numeric opacity-70">×{PACE_META[p].multiplier}</span>
          </Chip>
        ))}
      </nav>

      {(mode === 'all' || pace === 'all') && (
        <p className="mb-3 text-sm" style={{ color: 'var(--text-subtle)' }}>
          {t('leaderboard.mixedModes')}
        </p>
      )}

      {offline && (
        <p className="mb-3 text-sm" style={{ color: 'var(--text-subtle)' }}>
          {t('leaderboard.offline')}
        </p>
      )}

      {/*
        En femhundre fra D1 ble presentert som «ingen resultater enda — spill
        en runde», altså som at ingen hadde spilt. Det er ikke det samme som at
        vi ikke fikk sett etter.
      */}
      {failed && (
        <p role="alert" className="mb-3 text-sm" style={{ color: 'var(--danger)' }}>
          {t('leaderboard.error')}
        </p>
      )}

      {loading ? (
        <p role="status" className="py-16 text-center" style={{ color: 'var(--text-subtle)' }}>
          {t('leaderboard.loading')}
        </p>
      ) : entries.length === 0 ? (
        <p className="py-16 text-center" style={{ color: 'var(--text-subtle)' }}>
          {t('leaderboard.empty')}
        </p>
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {entries.map((e, i) => (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
              >
                <LeaderboardRow entry={e} place={i} isMe={i === myPlace} />
              </motion.li>
            ))}
          </ol>
          {me && myPlace === -1 && (
            <p className="mt-4 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
              {t('leaderboard.notListed')}
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
        active ? '' : 'border hover:bg-[var(--surface-card)]'
      }`}
      style={
        active
          ? { background: 'var(--accent)', color: 'var(--color-surface)' }
          : { borderColor: 'var(--border)', color: 'var(--text-subtle)' }
      }
    >
      {children}
    </button>
  )
}
