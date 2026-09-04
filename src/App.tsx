import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MotionConfig } from 'framer-motion'
import { Header, NamePrompt, ConfirmDialog, Logo } from './components/header'
import { CategoryPicker, ModePicker, PacePicker, WorldMapPicker } from './components/menu'
import { GameScreen } from './components/game'
import { Leaderboard, LeaderboardPanel } from './components/leaderboard'
import { FooterSection } from './components/footer'
import { BackgroundMap } from './components/BackgroundMap'
import { useGameSettings } from './contexts/useGameSettings'
import { DEFAULT_REGION_ID, getCategory, getRegion } from './game/regions'
import { getName } from './game/leaderboard'
import type { Mode, Pace } from './game/types'

function App() {
  const { t } = useTranslation()
  const { motion, pace: lastPace, setPace: rememberPace } = useGameSettings()
  // enkel skjerm-state; bytter til react-router når flere skjermer trengs
  const [regionId, setRegionId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  // satt tempo = runden er i gang; null betyr «står på oppstartsskjermen»
  const [pace, setPace] = useState<Pace | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  // tempo som venter på at spilleren skriver inn navn
  const [pendingPace, setPendingPace] = useState<Pace | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  // teller opp når en runde er lagret, så header og ledertavle leses på nytt
  const [profileVersion, setProfileVersion] = useState(0)

  const reset = () => {
    setRegionId(null)
    setCategoryId(null)
    setMode(null)
    setPace(null)
    setShowLeaderboard(false)
    setPendingPace(null)
  }

  // START: krever navn — ellers spør vi først og starter etterpå
  const startRound = (chosen: Pace) => {
    rememberPace(chosen)
    if (getName().trim()) setPace(chosen)
    else setPendingPace(chosen)
  }

  const region = regionId ? getRegion(regionId) : undefined
  const category = region && categoryId ? getCategory(region.id, categoryId) : undefined

  // toppnivå = ingenting valgt — da viser headeren "Tilbake til Spillarena"
  const atRoot = !region && !category && !mode && !showLeaderboard
  // en runde er i gang når tempo er valgt og ledertavla ikke dekker skjermen
  const inGame = Boolean(category && mode && pace && !showLeaderboard)

  // ett steg tilbake: ledertavle > tempo > modus > kategori > region
  const goBack = () => {
    if (showLeaderboard) {
      setShowLeaderboard(false)
    } else if (pace) {
      setPace(null)
    } else if (mode) {
      setMode(null)
    } else if (categoryId) {
      setCategoryId(null)
    } else if (regionId) {
      setRegionId(null)
    }
  }

  return (
    // «Mindre bevegelse» må også stoppe JS-animasjonene, ikke bare CSS-ene
    <MotionConfig reducedMotion={motion === 'reduced' ? 'always' : 'never'}>
      <div
        className="flex h-dvh flex-col overflow-hidden transition-colors duration-300"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        {/* bakveggen viser regionen du står i — standardregionen før du har valgt */}
        <BackgroundMap regionId={regionId ?? DEFAULT_REGION_ID} />
        <Header
          atRoot={atRoot}
          inGame={inGame}
          onBack={goBack}
          onHome={reset}
          onGiveUp={() => setConfirmGiveUp(true)}
          onEditName={() => setEditingName(true)}
          profileVersion={profileVersion}
        />

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {showLeaderboard ? (
            <Leaderboard regionId={regionId ?? DEFAULT_REGION_ID} />
          ) : !region ? (
            <section
              aria-label={t('menu.title')}
              className="flex min-h-full flex-col justify-center gap-6 px-4 py-6 sm:gap-8"
            >
              <div className="flex justify-center">
                <h1>
                  <Logo onClick={reset} size="large" />
                </h1>
              </div>
              <WorldMapPicker onPick={setRegionId} />
              <LeaderboardPanel
                key={profileVersion}
                regionId={DEFAULT_REGION_ID}
                onSeeAll={() => setShowLeaderboard(true)}
              />
              <FooterSection />
            </section>
          ) : !category ? (
            <CategoryPicker region={region} onPick={setCategoryId} />
          ) : !mode ? (
            <ModePicker regionId={region.id} category={category} onPick={setMode} />
          ) : !pace ? (
            <PacePicker
              regionId={region.id}
              category={category}
              mode={mode}
              initialPace={lastPace}
              onStart={startRound}
            />
          ) : (
            <GameScreen
              key={`${region.id}-${category.id}-${mode}-${pace}`}
              regionId={region.id}
              categoryId={category.id}
              mode={mode}
              pace={pace}
              onMenu={reset}
              onLeaderboard={() => setShowLeaderboard(true)}
              onRunRecorded={() => setProfileVersion((v) => v + 1)}
            />
          )}
        </main>

        {pendingPace && (
          <NamePrompt
            onConfirm={() => {
              setPace(pendingPace)
              setPendingPace(null)
              setProfileVersion((v) => v + 1)
            }}
            onCancel={() => setPendingPace(null)}
          />
        )}

        {confirmGiveUp && (
          <ConfirmDialog
            title={t('giveUp.title')}
            body={t('giveUp.body')}
            confirmLabel={t('giveUp.confirm')}
            danger
            onConfirm={() => {
              setConfirmGiveUp(false)
              reset()
            }}
            onCancel={() => setConfirmGiveUp(false)}
          />
        )}

        {editingName && (
          <NamePrompt
            variant="edit"
            onConfirm={() => {
              setEditingName(false)
              setProfileVersion((v) => v + 1)
            }}
            onCancel={() => setEditingName(false)}
          />
        )}
      </div>
    </MotionConfig>
  )
}

export default App
