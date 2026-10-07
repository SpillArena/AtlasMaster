import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MotionConfig, motion as fm } from 'framer-motion'
import { Header, NamePrompt, ConfirmDialog, Logo } from './components/header'
import { CategoryPicker, ModePicker, PacePicker, WorldMapPicker } from './components/menu'
import { GameScreen } from './components/game'
import { Leaderboard, LeaderboardPanel } from './components/leaderboard'
import { ProfilePanel } from './components/profile'
import { FooterSection } from './components/footer'
import { BackgroundMap } from './components/BackgroundMap'
import { useGameSettings } from './contexts/useGameSettings'
import { DEFAULT_REGION_ID, getCategory, getRegion } from './game/regions'
import { getName } from './game/leaderboard'
import { syncProgress, watchProgressSync } from './game/profileSync'
import type { Mode, Pace } from './game/types'
import { AccountBadge, resolveIdentity } from './account'
import { badgeLabels } from './game/badgeLabels'
import { getProgress } from './game/progress'

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
      // innstillingspanelet står i DOM-en hele tiden, lukket som `inert`
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
        {/* bakveggen viser regionen du står i — standardregionen før du har valgt */}
        <BackgroundMap regionId={regionId ?? DEFAULT_REGION_ID} />
        <Header
          inGame={inGame}
          onHome={reset}
          onGiveUp={() => setConfirmGiveUp(true)}
          onEditName={() => setShowProfile(true)}
          profileVersion={profileVersion}
          trail={trail}
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
          {showLeaderboard ? (
            <Leaderboard regionId={regionId ?? DEFAULT_REGION_ID} onBack={goBack} />
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
              {/*
                Dashbordet viser tavla på tvers av alle regioner.
                Den stod låst til standardregionen, altså Norge, på en skjerm
                der ingen region er valgt enda: en spiller som bare spiller
                Asia så aldri et eneste resultat av sitt eget der. API-et har
                alltid støttet den regionsløse tavla — ingen skjerm ba om den.
              */}
              <LeaderboardPanel
                key={profileVersion}
                regionId="all"
                onSeeAll={() => setShowLeaderboard(true)}
              />
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
          <ProfilePanel
            onAccount={() => {
              setShowProfile(false)
              setEditingName(true)
            }}
            onClose={() => setShowProfile(false)}
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
        {/* One account for the whole domain — say so, in the same corner in
            every game. Innlogging finnes også i headeren her, fra den gang
            AtlasMaster hadde kontoene alene; merket er det som er likt på tvers. */}
        <AccountBadge
          progress={getProgress()}
          labels={badgeLabels(t)}
          language={i18n.language}
        />
      </div>
    </MotionConfig>
  )
}

export default App
