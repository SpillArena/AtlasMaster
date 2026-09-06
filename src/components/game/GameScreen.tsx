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
import { rankFor } from '../../game/rank'
import type { CloudOutcome } from './ResultScreen'
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
 * Hvor lenge det rette svaret står framme etter et bomskudd, i millisekund.
 *
 * Lang nok til at øyet rekker å finne stedet på kartet og knytte navnet til
 * det; kort nok til at en runde på femti steder ikke blir en venteliste.
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
  const { t } = useTranslation()
  const { data, base, features, geom, projection, emblems } = loaded
  const { consent } = useCookieConsent()
  const { state, target, done, guess, type, skip, giveUp, timeout, resume, restart } =
    useQuizEngine(features, mode, pace)

  // tilpass projeksjon til omrisset når det finnes, ellers til dataene selv
  const fitData = base ?? data
  const isClick = mode === 'click'
  // kartet peker ut målet i flervalg og skriv. I flaggmodus ville et opplyst
  // land vært fasiten, så der står kartet stille som bakgrunn.
  const highlightTarget = mode === 'choice' || mode === 'type'
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
   * Feil svar: buzz, og ristingen skjer i HUD-en (se `flashKey` under).
   * Kartflata nikket her før. Etter «Modern Atlas» står kartet stille — det er
   * hovedpersonen, og tilbakemeldingen hører hjemme i panelet der svaret ble
   * gitt.
   */
  useEffect(() => {
    if (!state.flash) return
    playSfx('wrong')
    // kjøres for hvert nye bomskudd
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.flash?.n])

  /*
   * Etter et bomskudd står det rette svaret framme en liten stund før køen går
   * videre. Motoren kan ikke holde en klokke selv — en reduserer vet ikke
   * hva tid det er — så pausen ligger her.
   */
  useEffect(() => {
    if (state.phase !== 'reveal') return
    const id = window.setTimeout(resume, REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [state.phase, state.reveal?.n, resume])

  // hva den globale tavla svarte: plassering, eller hvorfor den ikke tok imot
  const [cloud, setCloud] = useState<CloudOutcome | null>(null)
  // lagre resultat til ledertavle og profil én gang når runden er ferdig
  const savedRef = useRef(false)
  useEffect(() => {
    if (state.phase !== 'finished' || savedRef.current) return
    savedRef.current = true
    playSfx('finish')

    const elapsedMs = (state.finishedAt ?? Date.now()) - state.startedAt
    // t() og ikke en hardkodet norsk streng: «Anonym» stod i den engelske
    // bygget også, og havnet slik på den globale tavla
    const name = getName().trim() || t('nav.anonymous')
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
      /*
       * Resultatet av innsendingen ble kastet før — `void submitScore(...)`.
       * En avvist innsending og en død tjener så like ut, og begge endte med
       * at spilleren fikk en helt vanlig resultatskjerm og aldri dukket opp på
       * tavla, uten et ord om hvorfor. Svaret bærer også plasseringen runden
       * fikk, som er det man vil vite.
       */
      void submitScore({
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
      }).then((result) => {
        if (result.ok) setCloud({ rank: result.data.rank })
        else setCloud({ rank: null, problem: result.reason })
      })
    }
    setRun(
      recordRun({
        regionId,
        categoryId,
        mode,
        pace: state.pace,
        score: state.points,
        correctCount,
        total: state.total,
        mistakes: state.mistakes,
        bestStreak: state.bestStreak,
        rank: rankFor({
          correctCount,
          total: state.total,
          mistakes: state.mistakes,
          bestStreak: state.bestStreak,
        }),
      }),
    )
    onRunRecorded()
    // kjøres kun ved overgang til 'finished'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  const handleRestart = () => {
    savedRef.current = false
    setCloud(null)
    setRun(null)
    restart()
  }

  /*
   * Fasiten på slutten: hva som røk, og hvor mange forsøk det kostet.
   *
   * Et sted havner her både når det ble bommet på og senere tatt, og når
   * spilleren ga opp — det er stedene runden avdekket som ikke satt, og de er
   * det eneste en spiller faktisk kan gjøre noe med til neste gang.
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

  // stabil referanse, ellers ville HUD-en tegnet seg på nytt for hvert klokketikk
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

      {/* Kart fyller tilgjengelig høyde. */}
      <div className="relative min-h-0 flex-1">
        <MapCanvas
          projectionSpec={projection}
          fitData={fitData}
          baseData={base}
          features={features}
          geom={geom}
          status={state.status}
          flashId={state.flash?.id ?? null}
          revealId={state.reveal?.id ?? null}
          highlightId={highlightTarget ? (target?.id ?? null) : null}
          award={state.award}
          interactive={isClick}
          onPick={guess}
          disabled={state.phase !== 'playing'}
        />

        {/*
          Resultatflata lå med `backdrop-filter` over kartet. Konfettien over
          den rører seg, og hver ramme tvang da nettleseren til å sløre
          hele kartutsnittet på nytt. En nesten ugjennomsiktig flate gir samme
          lesing uten den kostnaden.
        */}
        {state.phase === 'finished' && (
          <div
            className="absolute inset-0"
            style={{ background: 'color-mix(in srgb, var(--bg) 96%, transparent)' }}
          >
            <ResultScreen
              cloud={cloud}
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
           * Ikke i skrivemodus. Der står landet allerede markert på kartet,
           * og et flagg ved siden av ville vært fasiten for alle som kan
           * flagg — oppgaven er å huske navnet, ikke å kjenne igjen flagget.
           */
          emblems={mode === 'type' ? null : emblems}
          onChoose={guess}
          onType={type}
          onSkip={skip}
          onGiveUp={giveUp}
          flashKey={state.flash?.n ?? 0}
        />
      )}
    </section>
  )
}
