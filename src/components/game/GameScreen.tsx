import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FeatureCollection } from 'geojson'
import { getCategory } from '../../game/categories'
import { toQuizFeatures, type Mode, type QuizFeature, type GeomKind } from '../../game/types'
import { useQuizEngine } from '../../game/useQuizEngine'
import { addEntry, getName, scoreFor } from '../../game/leaderboard'
import { MapCanvas } from './MapCanvas'
import { GameHUD } from './GameHUD'
import { GameTopBar } from './GameTopBar'
import { ResultScreen } from './ResultScreen'

interface Props {
  categoryId: string
  mode: Mode
  onMenu: () => void
  onLeaderboard: () => void
}

interface Loaded {
  data: FeatureCollection
  base?: FeatureCollection
  features: QuizFeature[]
  geom: GeomKind
}

export function GameScreen({ categoryId, mode, onMenu, onLeaderboard }: Props) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let alive = true
    const cat = getCategory(categoryId)
    if (!cat) return
    Promise.all([cat.load(), cat.base?.() ?? Promise.resolve(undefined)]).then(
      ([data, base]) => {
        if (alive)
          setLoaded({ data, base, features: toQuizFeatures(data), geom: cat.geom })
      },
    )
    return () => {
      alive = false
    }
  }, [categoryId])

  if (!loaded) {
    return (
      <div
        role="status"
        className="flex h-full items-center justify-center text-sm font-medium"
        style={{ color: 'var(--text-subtle)' }}
      >
        {t('game.loading')}
      </div>
    )
  }

  return (
    <Game
      loaded={loaded}
      categoryId={categoryId}
      mode={mode}
      onMenu={onMenu}
      onLeaderboard={onLeaderboard}
    />
  )
}

function Game({
  loaded,
  categoryId,
  mode,
  onMenu,
  onLeaderboard,
}: {
  loaded: Loaded
  categoryId: string
  mode: Mode
  onMenu: () => void
  onLeaderboard: () => void
}) {
  const { data, base, features, geom } = loaded
  const { state, target, done, guess, type, skip, giveUp, restart } = useQuizEngine(
    features,
    mode,
  )

  const fitData = geom === 'point' && base ? base : data
  const isClick = mode === 'click'
  // antall faktisk riktige (oppgitt/«vet ikke» = 'revealed' teller ikke)
  const correctCount = Object.values(state.status).filter((s) => s === 'correct').length

  // lagre resultat til ledertavle én gang når runden er ferdig
  const savedRef = useRef(false)
  useEffect(() => {
    if (state.phase !== 'finished' || savedRef.current) return
    savedRef.current = true
    const elapsedMs = (state.finishedAt ?? Date.now()) - state.startedAt
    addEntry({
      name: getName().trim() || 'Anonym',
      score: scoreFor(correctCount, state.total, elapsedMs),
      categoryId,
      mode,
      correctCount,
      total: state.total,
      mistakes: state.mistakes,
      elapsedMs,
    })
    // kjøres kun ved overgang til 'finished'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])
  const choices = state.choices.map((id) => {
    const f = features.find((x) => x.id === id)
    return { id, name: f?.name ?? '' }
  })

  return (
    <section className="flex h-full flex-col">
      {/* riktig/feil + fremdrift øverst */}
      <GameTopBar
        correctCount={correctCount}
        done={done}
        total={state.total}
        mistakes={state.mistakes}
      />

      {/* kart fyller tilgjengelig høyde */}
      <div className="relative min-h-0 flex-1">
        <MapCanvas
          fitData={fitData}
          baseData={base}
          features={features}
          geom={geom}
          status={state.status}
          flashId={state.flash?.id ?? null}
          flashN={state.flash?.n ?? 0}
          highlightId={isClick ? null : target?.id ?? null}
          interactive={isClick}
          onPick={guess}
          disabled={state.phase === 'finished'}
        />

        {state.phase === 'finished' && (
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
          >
            <ResultScreen
              total={state.total}
              correctCount={correctCount}
              mistakes={state.mistakes}
              elapsedMs={(state.finishedAt ?? Date.now()) - state.startedAt}
              onRetry={restart}
              onMenu={onMenu}
              onLeaderboard={onLeaderboard}
            />
          </div>
        )}
      </div>

      {/* spill-kontroller nederst (tommelvennlig) */}
      {state.phase === 'playing' && (
        <GameHUD
          mode={mode}
          targetName={target?.name ?? ''}
          choices={choices}
          targetKey={target?.id ?? ''}
          onChoose={guess}
          onType={type}
          onSkip={skip}
          onGiveUp={giveUp}
        />
      )}
    </section>
  )
}
