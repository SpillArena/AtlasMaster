import { useState } from 'react'
import { Header, NamePrompt, Logo } from './components/header'
import { CategoryPicker, ModePicker } from './components/menu'
import { GameScreen } from './components/game'
import { Leaderboard } from './components/leaderboard'
import { getCategory } from './game/categories'
import { getName } from './game/leaderboard'
import type { Mode } from './game/types'

function App() {
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

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <Header onLeaderboard={() => setShowLeaderboard(true)} />

      <main>
        {showLeaderboard ? (
          <Leaderboard onBack={() => setShowLeaderboard(false)} />
        ) : !category ? (
          <>
            <div className="flex justify-center pt-8 pb-6">
              <h1>
                <Logo onClick={reset} size="large" />
              </h1>
            </div>
            <CategoryPicker onPick={setCategoryId} />
          </>
        ) : !mode ? (
          <ModePicker category={category} onPick={startGame} onBack={reset} />
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
