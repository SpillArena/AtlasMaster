import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { CategoryPicker } from './components/CategoryPicker'
import { ModePicker } from './components/ModePicker'
import { GameScreen } from './components/GameScreen'
import { Leaderboard } from './components/Leaderboard'
import { NameInput } from './components/NameInput'
import { NorwayFlag } from './components/NorwayFlag'
import { Icon } from './components/Icon'
import { getCategory } from './game/categories'
import type { Mode } from './game/types'

function App() {
  const { t } = useTranslation()
  // enkel skjerm-state; bytter til react-router når flere skjermer trengs
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const reset = () => {
    setCategoryId(null)
    setMode(null)
    setShowLeaderboard(false)
  }

  const category = categoryId ? getCategory(categoryId) : undefined

  return (
    <div className="min-h-screen bg-white text-gray-900 transition-colors duration-300 dark:bg-gray-950 dark:text-gray-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4">
        <button
          onClick={reset}
          className="flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 shadow-sm ring-1 ring-black/10 transition-transform hover:scale-[1.03]"
          style={{ backgroundColor: '#BA0C2F' }}
        >
          <NorwayFlag className="h-4 w-[1.375rem] rounded-[2px] ring-1 ring-white/40" />
          <span className="hidden text-base font-extrabold tracking-tight text-white sm:inline">
            NorgesMester
          </span>
        </button>
        <div className="flex items-center gap-2">
          <NameInput />
          <button
            onClick={() => setShowLeaderboard(true)}
            aria-label={t('leaderboard.title')}
            className="flex h-9 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <Icon name="trophy" className="h-4 w-4 text-amber-500" />
          </button>
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      <main>
        {showLeaderboard ? (
          <Leaderboard onBack={() => setShowLeaderboard(false)} />
        ) : !category ? (
          <CategoryPicker onPick={setCategoryId} />
        ) : !mode ? (
          <ModePicker category={category} onPick={setMode} onBack={reset} />
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
    </div>
  )
}

export default App
