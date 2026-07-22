import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Header, NamePrompt, Logo } from './components/header'
import { CategoryPicker, ModePicker } from './components/menu'
import { GameScreen } from './components/game'
import { Leaderboard } from './components/leaderboard'
import { BackgroundMap } from './components/BackgroundMap'
import { getCategory } from './game/categories'
import { getName } from './game/leaderboard'
import type { Mode } from './game/types'

function App() {
  const { t } = useTranslation()
  // enkel skjerm-state; bytter til react-router når flere skjermer trengs
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  // modus venter på navn når spiller starter spill uten å ha satt navn
  const [pendingMode, setPendingMode] = useState<Mode | null>(null)

  const reset = () => {
    setCategoryId(null)
    setMode(null)
    setShowLeaderboard(false)
    setPendingMode(null)
  }

  // start spill direkte hvis navn finnes, ellers be om navn først
  const startGame = (m: Mode) => {
    if (getName().trim()) setMode(m)
    else setPendingMode(m)
  }

  const category = categoryId ? getCategory(categoryId) : undefined

  // toppnivå = ingen kategori/modus/ledertavle valgt — da viser headeren
  // "Tilbake til Spillarena" i stedet for et internt tilbake-steg
  const atRoot = !category && !mode && !showLeaderboard

  // ett steg tilbake: lukk ledertavle > forlat spillmodus > forlat kategori
  const goBack = () => {
    if (showLeaderboard) {
      setShowLeaderboard(false)
    } else if (mode) {
      setMode(null)
    } else if (categoryId) {
      setCategoryId(null)
    }
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <BackgroundMap />
      <Header onLeaderboard={() => setShowLeaderboard(true)} atRoot={atRoot} onBack={goBack} />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {showLeaderboard ? (
          <Leaderboard />
        ) : !category ? (
          <section aria-label={t('menu.title')}>
            <div className="flex justify-center pb-6 pt-6 sm:pt-8">
              <h1>
                <Logo onClick={reset} size="large" />
              </h1>
            </div>
            <CategoryPicker onPick={setCategoryId} />
          </section>
        ) : !mode ? (
          <ModePicker category={category} onPick={startGame} />
        ) : (
          <GameScreen
            key={`${category.id}-${mode}`}
            categoryId={category.id}
            mode={mode}
            onMenu={reset}
            onLeaderboard={() => setShowLeaderboard(true)}
          />
        )}
      </main>

      {pendingMode && (
        <NamePrompt
          onConfirm={() => {
            setMode(pendingMode)
            setPendingMode(null)
          }}
          onCancel={() => setPendingMode(null)}
        />
      )}
    </div>
  )
}

export default App
