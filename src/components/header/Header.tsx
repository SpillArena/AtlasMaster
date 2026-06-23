import ThemeSwitcher from './ThemeSwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import { NameInput } from './NameInput'
import { LeaderboardButton } from './LeaderboardButton'
import { BackToArena } from './BackToArena'

interface Props {
  /** Åpne ledertavla. */
  onLeaderboard: () => void
}

/** Topptekst-bar: back button, navn + handlinger. */
export function Header({ onLeaderboard }: Props) {
  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <BackToArena />
          <div className="flex items-center gap-2">
            <NameInput />
            <LeaderboardButton onClick={onLeaderboard} />
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </header>
  )
}
