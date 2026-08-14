import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FeatureCollection } from 'geojson'
import type { EmblemSet } from '../../game/flags'
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
import { SCORING_VERSION } from '../../game/scoring'
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

/**
 * Kor lenge det rette svaret står framme etter eit bomskot, i millisekund.
 *
 * Lang nok til at auget rekk å finne staden på kartet og knyte namnet til
 * han; kort nok til at ei runde på femti stader ikkje blir ei venteliste.
 */
const REVEAL_MS = 1200

interface Loaded {
  data: FeatureCollection
  base?: FeatureCollection
  features: QuizFeature[]
  geom: GeomKind
  projection: ProjectionSpec
  /** merkesettet kategorien viser ved siden av navnene, om noen */
  emblems: EmblemSet | null
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
          emblems: cat.emblems ?? null,
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
  const { data, base, features, geom, projection, emblems } = loaded
  const { consent } = useCookieConsent()
  const { state, target, done, guess, type, skip, giveUp, timeout, resume, restart } =
    useQuizEngine(features, mode, pace)

  // tilpass projeksjon til omrisset når det finnes, ellers til dataene selv
  const fitData = base ?? data
  const isClick = mode === 'click'
  // antall faktisk riktige (oppgitt/«vet ikke» = 'revealed' teller ikke)
  const correctCount = Object.values(state.status).filter((s) => s === 'correct').length

  const questionMs = PACE_META[state.pace].seconds * 1000
  const [run, setRun] = useState<RunResult | null>(null)

  // riktig svar: lyd som stiger med rekka
  useEffect(() => {
    if (!state.award) return
    playSfx(state.award.combo >= 5 ? 'combo' : 'correct', state.award.combo)
    // kjøres for hver nye utdeling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.award?.n])

  /*
   * Feil svar: buzz og eit nikk i kartflata.
   *
   * Nikket er ein CSS-keyframe, ikkje ei JS-animasjon. Klassen må fjernast og
   * leggjast på att med ein reflow imellom for å starte på nytt — alternativet
   * er ein ny `key` på flata, og det ville rive ned heile kartet for kvart
   * bomskot.
   */
  const nudgeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!state.flash) return
    playSfx('wrong')
    const el = nudgeRef.current
    if (!el) return
    el.classList.remove('map-nudge')
    void el.offsetWidth
    el.classList.add('map-nudge')
    // kjøres for hvert nye bomskot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.flash?.n])

  /*
   * Etter eit bomskot står det rette svaret framme ei lita stund før køen går
   * vidare. Motoren kan ikkje halde ei klokke sjølv — ein reduserar veit ikkje
   * kva tid det er — så pausen ligg her.
   */
  useEffect(() => {
    if (state.phase !== 'reveal') return
    const id = window.setTimeout(resume, REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [state.phase, state.reveal?.n, resume])

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
      scoringVersion: SCORING_VERSION,
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

  /*
   * Fasiten på slutten: kva som rauk, og kor mange forsøk det kosta.
   *
   * Eit sted hamnar her både når det blei bomma på og seinare teke, og når
   * spelaren gav opp — det er stadene runden avdekte som ikkje sat, og dei er
   * det einaste ein spelar faktisk kan gjere noko med til neste gong.
   */
  const missed = useMemo(
    () =>
      state.missed.map((id) => ({
        id,
        name: features.find((f) => f.id === id)?.name ?? id,
        attempts: state.attempts[id] ?? 0,
        solved: state.status[id] === 'correct',
      })),
    [state.missed, state.attempts, state.status, features],
  )

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
        remaining={state.queue.length}
        mistakes={state.mistakes}
        questionStartedAt={state.questionStartedAt}
        questionMs={questionMs}
        running={state.phase === 'playing'}
        onTimeout={timeout}
      />

      {/*
        Kart fyller tilgjengelig høyde; flaten får et lite nikk ved feilsvar.
        Nikket køyrer gjennom `controls` og ikkje ved å byte `key`: ein ny
        nøkkel ville rive ned og bygge opp att heile kartet — terreng, zoom og
        alt — for kvart bomskot.
      */}
      <div ref={nudgeRef} className="relative min-h-0 flex-1">
        <MapCanvas
          projectionSpec={projection}
          fitData={fitData}
          baseData={base}
          features={features}
          geom={geom}
          status={state.status}
          flashId={state.flash?.id ?? null}
          revealId={state.reveal?.id ?? null}
          highlightId={isClick ? null : (target?.id ?? null)}
          award={state.award}
          interactive={isClick}
          onPick={guess}
          disabled={state.phase !== 'playing'}
        />

        {/*
          Resultatflata låg med `backdrop-filter` over kartet. Konfettien over
          henne rører seg, og kvar ramme tvinga då nettlesaren til å sløre
          heile kartutsnittet på nytt. Ei nesten ugjennomsiktig flate gjev same
          lesing utan den kostnaden.
        */}
        {state.phase === 'finished' && (
          <div
            className="absolute inset-0"
            style={{ background: 'color-mix(in srgb, var(--bg) 96%, transparent)' }}
          >
            <ResultScreen
              total={state.total}
              correctCount={correctCount}
              mistakes={state.mistakes}
              bestStreak={state.bestStreak}
              score={state.points}
              mode={mode}
              missed={missed}
              elapsedMs={(state.finishedAt ?? state.startedAt) - state.startedAt}
              run={run}
              onRetry={handleRestart}
              onMenu={onMenu}
              onLeaderboard={onLeaderboard}
            />
          </div>
        )}
      </div>

      {/* spill-kontroller nederst (tommelvennlig) */}
      {state.phase !== 'finished' && (
        <GameHUD
          mode={mode}
          targetName={target?.name ?? ''}
          choices={choices}
          targetKey={target?.id ?? ''}
          revealId={state.reveal?.id ?? null}
          /*
           * Ikkje i skrivemodus. Der står landet allereie markert på kartet,
           * og eit flagg ved sida av ville vore fasiten for alle som kan
           * flagg — oppgåva er å hugse namnet, ikkje å kjenne att flagget.
           */
          emblems={mode === 'type' ? null : emblems}
          onChoose={guess}
          onType={type}
          onSkip={skip}
          onGiveUp={giveUp}
        />
      )}
    </section>
  )
}
