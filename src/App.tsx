import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MotionConfig, motion as fm } from 'framer-motion'
import { Header, NamePrompt, ConfirmDialog } from './components/header'
import { WorldMapPicker } from './components/menu/WorldMapPicker'
import { LeaderboardPanel } from './components/leaderboard/LeaderboardPanel'
import { FooterSection } from './components/footer'
import { LandingHero, ModeStrip } from './components/menu/Landing'
import { useGameSettings } from './contexts/useGameSettings'
import { DEFAULT_REGION_ID, getCategory, getRegion } from './game/regions'
import { getName } from './game/leaderboard'
import { syncProgress, watchProgressSync } from './game/profileSync'
import type { Mode, Pace } from './game/types'
import { AccountBadge, resolveIdentity } from './account'
import { badgeLabels } from './game/badgeLabels'
import { getProgress } from './game/progress'

// Screens are loaded when visited; the landing page does not need the quiz,
// world flag images, or every menu's rendering code.
const GameScreen = lazy(() => import('./components/game/GameScreen').then((m) => ({ default: m.GameScreen })))
const CategoryPicker = lazy(() => import('./components/menu/CategoryPicker').then((m) => ({ default: m.CategoryPicker })))
const ModePicker = lazy(() => import('./components/menu/ModePicker').then((m) => ({ default: m.ModePicker })))
const PacePicker = lazy(() => import('./components/menu/PacePicker').then((m) => ({ default: m.PacePicker })))
const Leaderboard = lazy(() => import('./components/leaderboard/Leaderboard').then((m) => ({ default: m.Leaderboard })))
const ProfilePanel = lazy(() => import('./components/profile/ProfilePanel').then((m) => ({ default: m.ProfilePanel })))

function App() {
  const { t, i18n } = useTranslation()
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
  // profilen: alt spillet vet om deg, som ikke fantes noe sted før
  const [showProfile, setShowProfile] = useState(false)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  // teller opp når en runde er lagret, så header og ledertavle leses på nytt
  const [profileVersion, setProfileVersion] = useState(0)

  /*
   * Ved oppstart: er økten fra sist fortsatt gyldig, hent kontoens profil og
   * smelt den inn i det enheten alt har liggende. Trygt å kjøre hver gang
   * appen laster — se mergeProgress i game/progress.ts for hvorfor.
   */
  useEffect(() => {
    void syncProgress()
    // og på nytt hvis kontoen byttes mens spillet står åpent — innlogging skjer
    // like gjerne på forsiden, i en annen fane
    return watchProgressSync()
  }, [])

  const reset = () => {
    setRegionId(null)
    setCategoryId(null)
    setMode(null)
    setPace(null)
    setShowLeaderboard(false)
    setPendingPace(null)
  }

  /*
   * START: krever et navn — ellers spør vi først og starter etterpå.
   *
   * En innlogget spiller blir ALDRI spurt. Navnet kommer fra kontoen, og tavla
   * tar det fra det signerte tegnet uansett hva som står i et felt her, så et
   * spørsmål ville vært et spørsmål med bare ett gyldig svar. `resolveIdentity`
   * er det samme svaret i alle spillene — se src/account/identity.ts.
   *
   * Den lokale navnesjekken er fortsatt der for gjester, som er de eneste den
   * gjelder for.
   */
  const startRound = (chosen: Pace) => {
    rememberPace(chosen)
    if (resolveIdentity(getName()).name.trim()) setPace(chosen)
    else setPendingPace(chosen)
  }

  const region = regionId ? getRegion(regionId) : undefined
  const category = region && categoryId ? getCategory(region.id, categoryId) : undefined

  // en runde er i gang når tempo er valgt og ledertavla ikke dekker skjermen
  const inGame = Boolean(category && mode && pace && !showLeaderboard)

  /*
   * Sporet i headeren: hvor i feltboka man står.
   *
   * Kategori-, modus- og temposkjermene så identiske ut fra hverandre —
   * samme bakgrunn, samme plate, samme tilbake-knapp — og ingenting sa om man
   * var på vei inn i Europa eller i Asia.
   */
  const parent = region?.parent ? getRegion(region.parent) : undefined
  const trail = [
    parent && t(parent.labelKey),
    region && t(region.labelKey),
    category && t(category.labelKey),
    mode && t(`mode.${mode}.title`),
  ].filter((part): part is string => Boolean(part))

  // ett steg tilbake: ledertavle > tempo > modus > kategori > region
  const goBack = useCallback(() => {
    if (showLeaderboard) {
      setShowLeaderboard(false)
    } else if (pace) {
      setPace(null)
    } else if (mode) {
      setMode(null)
    } else if (categoryId) {
      setCategoryId(null)
    } else if (regionId) {
      // en underregion (USA) går tilbake til menyen den ligger i, ikke hjem
      setRegionId(region?.parent ?? null)
    }
  }, [showLeaderboard, pace, mode, categoryId, regionId, region])

  /*
   * Escape er «tilbake» i menyene — samme steg som tilbake-knappen.
   *
   * Ikke i en runde: der betyr et feiltrykk at runden er borte, og spillet har
   * egen «gi opp» med bekreftelse. Ikke mens noe ligger oppå heller —
   * innstillinger, kontopanelet, samtykke, navnefeltet. De lukker seg selv på
   * Escape, og ett trykk skal gjøre én ting: lukke det øverste, ikke lukke det
   * *og* hoppe en skjerm tilbake bak det. Alle slike flater har
   * `role="dialog"` mens de er åpne.
   *
   * MERK — lytteren står i capture-fasen med vilje. Popoverne lukker seg i
   * vanlige lyttere, og React tømmer tilstanden sin i en mikrooppgave mellom
   * to lyttere: når en bobblende lytter her fikk spørre, var dialogen alt
   * borte fra DOM-en, og samme trykk lukket panelet og gikk tilbake. I
   * capture-fasen spør vi før noen av dem har rørt seg.
   */
  const overlayOpen = editingName || showProfile || confirmGiveUp || pendingPace !== null
  useEffect(() => {
    if (inGame || overlayOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) return
      // ikke naviger bak et åpent dialogvindu
      if (document.querySelector('[role="dialog"]:not([inert]):not([aria-hidden="true"])')) return
      goBack()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [goBack, inGame, overlayOpen])

  return (
    // «Mindre bevegelse» må også stoppe JS-animasjonene, ikke bare CSS-ene
    <MotionConfig reducedMotion={motion === 'reduced' ? 'always' : 'never'}>
      <div
        className="flex h-dvh flex-col overflow-hidden transition-colors duration-300"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <Header
          inGame={inGame}
          onHome={reset}
          onGiveUp={() => setConfirmGiveUp(true)}
          trail={trail}
          account={
            <AccountBadge
              corner="header"
              progress={getProgress()}
              labels={badgeLabels(t)}
              language={i18n.language}
            />
          }
        />

        {/*
          Overgangen mellom skjermene.
          Region, kategori, modus, tempo og runden byttet før ut innholdet i
          `main` uten et bilde imellom — fire nesten like skjermer som klippet
          brått fra en til neste. Nøkkelen er hvor man står, så React bytter ut
          treet og motion spiller inn det nye; det er `opacity` og `transform`,
          altså kompositoren, og `MotionConfig` øverst slår det av under
          «mindre bevegelse» sammen med resten.
        */}
        <fm.main
          key={`${showLeaderboard ? 'board' : (regionId ?? 'root')}:${categoryId ?? ''}:${mode ?? ''}:${pace ?? ''}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain arena-main"
        >
          <Suspense fallback={<p role="status" className="p-6 text-center">{t('game.loading')}</p>}>
            {showLeaderboard ? (
              <Leaderboard regionId={regionId ?? DEFAULT_REGION_ID} onBack={goBack} />
            ) : !region ? (
              <section
                aria-label={t('menu.title')}
                className="flex min-h-full flex-col gap-4 pt-4 sm:pt-6"
              >
                <LandingHero />
                <WorldMapPicker onPick={setRegionId} />
                <ModeStrip />
                {/*
                  Dashbordet viser tavla på tvers av alle regioner.
                  Den stod låst til standardregionen, altså Norge, på en skjerm
                  der ingen region er valgt enda: en spiller som bare spiller
                  Asia så aldri et eneste resultat av sitt eget der. API-et har
                  alltid støttet den regionsløse tavla — ingen skjerm ba om den.
                */}
                <div className="mx-auto w-full max-w-[1360px] px-4 pb-6">
                  <LeaderboardPanel
                    key={profileVersion}
                    regionId="all"
                    onSeeAll={() => setShowLeaderboard(true)}
                  />
                </div>
                <FooterSection />
              </section>
            ) : !category ? (
              <CategoryPicker region={region} onPick={setCategoryId} onPickRegion={setRegionId} onBack={goBack} />
            ) : !mode ? (
              <ModePicker regionId={region.id} category={category} onPick={setMode} onBack={goBack} />
            ) : !pace ? (
              <PacePicker
                regionId={region.id}
                category={category}
                mode={mode}
                initialPace={lastPace}
                onStart={startRound}
                onBack={goBack}
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
          </Suspense>
        </fm.main>

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

        {showProfile && (
          <Suspense fallback={null}>
            <ProfilePanel
              onAccount={() => {
                setShowProfile(false)
                setEditingName(true)
              }}
              onClose={() => setShowProfile(false)}
            />
          </Suspense>
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
