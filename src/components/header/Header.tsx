import SettingsMenu from './SettingsMenu'
import { PlayerChip } from './PlayerChip'
import { BackToArena } from './BackToArena'

interface Props {
  /** true på toppnivå (ingen kategori/modus/ledertavle valgt) */
  atRoot: boolean
  /** true mens en runde spilles — tilbake-knappen blir «Gi opp» */
  inGame: boolean
  /** ber om bekreftelse før runden forlates */
  onGiveUp: () => void
  /** går ett steg tilbake i appen — brukes når ikke på toppnivå */
  onBack: () => void
  /** åpner navneredigering */
  onEditName: () => void
  /** endres når en runde er lagret, så spillerkortet leser profilen på nytt */
  profileVersion: number
}

/**
 * Toppbar: tilbake, spillerkort og innstillinger. Ledertavla bor på
 * dashbordet, ikke bak en knapp her oppe.
 */
export function Header({ atRoot, inGame, onBack, onGiveUp, onEditName, profileVersion }: Props) {
  return (
    <header className="sticky top-0 z-40 shrink-0">
      <div className="mx-auto max-w-6xl px-2.5 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <BackToArena atRoot={atRoot} inGame={inGame} onBack={onBack} onGiveUp={onGiveUp} />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <PlayerChip key={profileVersion} onEdit={onEditName} />
            <SettingsMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
