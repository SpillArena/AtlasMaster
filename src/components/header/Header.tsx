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
    <header className="sticky top-0 z-40 shrink-0">
      <div className="mx-auto max-w-6xl px-2.5 py-2.5 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <BackToArena />
          <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
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
