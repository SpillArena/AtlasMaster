import { useTranslation } from 'react-i18next'
import SettingsMenu from './SettingsMenu'
import { PlayerChip } from './PlayerChip'
import { BackToArena } from './BackToArena'
import { AtlasMark } from './AtlasMark'

interface Props {
  /** true på toppnivå (ingen kategori/modus/ledertavle valgt) */
  atRoot: boolean
  /** true mens en runde spilles — tilbake-knappen blir «Gi opp» */
  inGame: boolean
  /** ber om bekreftelse før runden forlates */
  onGiveUp: () => void
  /** går ett steg tilbake i appen — brukes når ikke på toppnivå */
  onBack: () => void
  /** hopper rett til toppnivå — brukes av merket i baren */
  onHome: () => void
  /** åpner navneredigering */
  onEditName: () => void
  /** endres når en runde er lagret, så spillerkortet leser profilen på nytt */
  profileVersion: number
}

/**
 * Toppbar: tilbake, spillerkort og innstillinger. Ledertavla bor på
 * dashbordet, ikke bak en knapp her oppe.
 *
 * Merket vises bare når ikke på toppnivå: der står det allerede stort i
 * dashbordet, så å gjenta det i baren ville bare vært støy. Alle andre
 * skjermer — kategori, modus, tempo, selve runden — har ellers ingen
 * AtlasMaster-identitet i det hele, bare en generisk tilbake-knapp.
 */
export function Header({
  atRoot,
  inGame,
  onBack,
  onGiveUp,
  onHome,
  onEditName,
  profileVersion,
}: Props) {
  const { t } = useTranslation()

  return (
    <header
      className="sticky top-0 z-40 shrink-0 border-b"
      style={{
        background: 'var(--nav-bg)',
        borderColor: 'color-mix(in srgb, var(--brass) 45%, transparent)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div className="mx-auto max-w-6xl px-2.5 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {!atRoot && (
              <button
                type="button"
                onClick={onHome}
                aria-label={t('menu.title')}
                title={t('menu.title')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[var(--border-hover)]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <AtlasMark className="h-5 w-5" />
              </button>
            )}
            <BackToArena atRoot={atRoot} inGame={inGame} onBack={onBack} onGiveUp={onGiveUp} />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <PlayerChip key={profileVersion} onEdit={onEditName} />
            <SettingsMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
