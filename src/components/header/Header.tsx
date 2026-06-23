import ThemeSwitcher from './ThemeSwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import { Logo } from './Logo'
import { NameInput } from './NameInput'
import { LeaderboardButton } from './LeaderboardButton'

interface Props {
  /** Tilbake til hovedmenyen. */
  onHome: () => void
  /** Åpne ledertavla. */
  onLeaderboard: () => void
}

/** Topptekst-bar: logo til venstre, navn + handlinger til høyre. */
export function Header({ onHome, onLeaderboard }: Props) {
  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Logo onClick={onHome} />
        <div className="flex items-center gap-2">
          <NameInput />
          <LeaderboardButton onClick={onLeaderboard} />
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  )
}
