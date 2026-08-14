import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useAnimationControls } from 'framer-motion'
import type { FeatureCollection } from 'geojson'
import { getCategory, getRegion } from '../../game/regions'
import {
  PACE_META,
  toQuizFeatures,
  type GeomKind,
  type Mode,
  type Pace,
  type ProjectionSpec,
  type QuizFeature,
} from '../../game/types'
import { useQuizEngine } from '../../game/useQuizEngine'
import { addEntry, getName } from '../../game/leaderboard'
import { recordRun, type RunResult } from '../../game/progress'
import { playSfx } from '../../game/sfx'
import { submitScore } from '../../game/scoreApi'
import { useCookieConsent } from '../../contexts/useCookieConsent'
import { MapCanvas } from './MapCanvas'
import { GameHUD } from './GameHUD'
import { GameTopBar } from './GameTopBar'
import { ResultScreen } from './ResultScreen'

interface Props {
  regionId: string
  categoryId: string
  mode: Mode
  /** tempoet spilleren valgte for denne runden */
  pace: Pace
  onMenu: () => void
  onLeaderboard: () => void
  /** varsler at en runde er lagret, så headeren kan lese nivået på nytt */
  onRunRecorded: () => void
}

interface Loaded {
  data: FeatureCollection
  base?: FeatureCollection
  features: QuizFeature[]
  geom: GeomKind
  projection: ProjectionSpec
}

export function GameScreen({
  regionId,
  categoryId,
  mode,
  pace,
  onMenu,
  onLeaderboard,
  onRunRecorded,
}: Props) {
  const { t, i18n } = useTranslation()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const lang = i18n.language


  useEffect(() => {
    let alive = true
    const region = getRegion(regionId)
    const cat = getCategory(regionId, categoryId)
    if (!region || !cat) return
    Promise.all([cat.load(), cat.base?.() ?? Promise.resolve(undefined)]).then(([data, base]) => {
      if (alive)
        setLoaded({
          data,
          base,
          features: toQuizFeatures(data, lang),
          geom: cat.geom,
          projection: region.projection,
        })
    })
    return () => {
      alive = false
    }
  }, [regionId, categoryId, lang])

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
      regionId={regionId}
      categoryId={categoryId}
      mode={mode}
      pace={pace}
      onMenu={onMenu}
      onLeaderboard={onLeaderboard}
      onRunRecorded={onRunRecorded}
    />
  )
}

function Game({
  loaded,
  regionId,
  categoryId,
  mode,
  pace,
  onMenu,
  onLeaderboard,
  onRunRecorded,
}: {
  loaded: Loaded
  regionId: string
  categoryId: string
  mode: Mode
  pace: Pace
  onMenu: () => void
  onLeaderboard: () => void
  onRunRecorded: () => void
}) {
  const { data, base, features, geom, projection } = loaded
  const { consent } = useCookieConsent()
  const { state, target, done, guess, type, skip, giveUp, timeout, restart } = useQuizEngine(
    features,
    mode,
    pace,
  )

  // tilpass projeksjon til omrisset når det finnes, ellers til dataene selv
  const fitData = base ?? data
  const isClick = mode === 'click'
  // antall faktisk riktige (oppgitt/«vet ikke» = 'revealed' teller ikke)
  const correctCount = Object.values(state.status).filter((s) => s === 'correct').length

  const questionMs = PACE_META[state.pace].seconds * 1000
  const [remainingMs, setRemainingMs] = useState(questionMs)
  const [run, setRun] = useState<RunResult | null>(null)

  // klokka for ett spørsmål — starter på nytt for hvert nye mål
  useEffect(() => {
    if (!questionMs || state.phase !== 'playing') return
    const deadline = state.questionStartedAt + questionMs
    let warned = false

    const tick = () => {
      const left = Math.max(0, deadline - Date.now())
      setRemainingMs(left)
      if (left <= 3000 && left > 0 && !warned) {
        warned = true
        playSfx('tick')
      }
      if (left === 0) timeout()
    }

    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [state.questionStartedAt, state.phase, questionMs, timeout])

  // riktig svar: lyd som stiger med rekka
  useEffect(() => {
    if (!state.award) return
    playSfx(state.award.combo >= 5 ? 'combo' : 'correct', state.award.combo)
    // kjøres for hver nye utdeling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.award?.n])

  // feil svar: buzz og eit nikk i kartflata
  const nudge = useAnimationControls()
  useEffect(() => {
    if (!state.flash) return
    playSfx('wrong')
    void nudge.start({ x: [0, -3, 3, 0], transition: { duration: 0.2 } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.flash?.n])

  // lagre resultat til ledertavle og profil én gang når runden er ferdig
  const savedRef = useRef(false)
  useEffect(() => {
    if (state.phase !== 'finished' || savedRef.current) return
    savedRef.current = true
    playSfx('finish')

    const elapsedMs = (state.finishedAt ?? Date.now()) - state.startedAt
    const name = getName().trim() || 'Anonym'
    addEntry({
      name,
      score: state.points,
      categoryId,
      regionId,
      mode,
      correctCount,
      total: state.total,
      mistakes: state.mistakes,
      elapsedMs,
      bestStreak: state.bestStreak,
      pace: state.pace,
    })

    // den globale tavla får resultatet bare når spilleren har sagt ja —
    // den lokale runden er uansett lagret over
    if (consent === 'accepted') {
      void submitScore({
        username: name,
        category: categoryId,
        region: regionId,
        mode,
        pace: state.pace,
        score: state.points,
        correctCount,
        total: state.total,
        mistakes: state.mistakes,
        bestStreak: state.bestStreak,
        elapsedMs,
      })
    }
    setRun(recordRun(regionId, categoryId, mode, state.points))
    onRunRecorded()
    // kjøres kun ved overgang til 'finished'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  const handleRestart = () => {
    savedRef.current = false
    setRun(null)
    restart()
  }

  // stabil referanse, elles ville HUD-en teikna seg på nytt for kvart klokketikk
  const choices = useMemo(
    () =>
      state.choices.map((id) => {
        const f = features.find((x) => x.id === id)
        return { id, name: f?.name ?? '' }
      }),
    [state.choices, features],
  )

  return (
    <section className="flex h-full flex-col">
      <GameTopBar
        points={state.points}
        streak={state.streak}
        correctCount={correctCount}
        done={done}
        total={state.total}
        mistakes={state.mistakes}
        remainingMs={remainingMs}
        questionMs={questionMs}
      />

      {/*
        Kart fyller tilgjengelig høyde; flaten får et lite nikk ved feilsvar.
        Nikket køyrer gjennom `controls` og ikkje ved å byte `key`: ein ny
        nøkkel ville rive ned og bygge opp att heile kartet — terreng, zoom og
        alt — for kvart bomskot.
      */}
      <motion.div className="relative min-h-0 flex-1" animate={nudge}>
        <MapCanvas
          projectionSpec={projection}
          fitData={fitData}
          baseData={base}
          features={features}
          geom={geom}
          status={state.status}
          flashId={state.flash?.id ?? null}
          highlightId={isClick ? null : target?.id ?? null}
          award={state.award}
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
              bestStreak={state.bestStreak}
              score={state.points}
              elapsedMs={(state.finishedAt ?? state.startedAt) - state.startedAt}
              run={run}
              onRetry={handleRestart}
              onMenu={onMenu}
              onLeaderboard={onLeaderboard}
            />
          </div>
        )}
      </motion.div>

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
