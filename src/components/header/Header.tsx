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
  /**
   * Hvor i feltboka man står, ferdig oversatt: region, kategori, modus.
   * Tom på toppnivå.
   */
  trail?: string[]
}

/**
 * Toppbaren er tittelbladet i feltboka.
 *
 * Tre soner: merket og veien ut til venstre, hvor man står i midten, hvem man
 * er til høyre. Under det hele en dobbel messinglinje — den tykke og den
 * tynne — slik en tittelside i en gammel atlas er skilt fra kartbladene.
 *
 * Merket stod bare på de indre skjermene før, med den begrunnelsen at
 * dashbordet allerede har det stort. Det var riktig om baren bare var
 * navigasjon; en masthead uten sitt eget merke er derimot bare en rad med
 * knapper, og alle de indre skjermene — kategori, modus, tempo, runden — hadde
 * da ingen AtlasMaster-identitet i det hele tatt.
 *
 * Sporet i midten er det som faktisk manglet: fire skjermer på rad så like ut,
 * og ingenting sa om man var i Europa eller i Asia. Det er skjult på smale
 * skjermer, der plassen tilhører de to knappene som gjør noe.
 *
 * Ledertavla bor på dashbordet, ikke bak en knapp her oppe.
 */
export function Header({
  atRoot,
  inGame,
  onBack,
  onGiveUp,
  onHome,
  onEditName,
  profileVersion,
  trail = [],
}: Props) {
  const { t } = useTranslation()

  return (
    <header
      className="sticky top-0 z-40 shrink-0"
      style={{
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div className="mx-auto max-w-6xl px-2.5 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onHome}
              aria-label={t('menu.title')}
              title={t('menu.title')}
              className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[var(--border-hover)]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <AtlasMark className="h-5 w-5 transition-transform duration-500 ease-out group-hover:rotate-45" />
            </button>
            <BackToArena atRoot={atRoot} inGame={inGame} onBack={onBack} onGiveUp={onGiveUp} />
          </div>

          {/*
            Ledgerlinja: hvor man står, satt som en katalogtekst. `flex-1` gjør
            at den tar plassen som blir til overs mellom de to knappegruppene,
            og `truncate` at en lang kategori aldri dytter dem fra hverandre.
          */}
          {trail.length > 0 && (
            <nav
              aria-label={t('region.title')}
              className="hidden min-w-0 flex-1 justify-center md:flex"
            >
              <span className="truncate text-caption uppercase tracking-[0.2em]" style={{ color: 'var(--text-subtle)' }}>
                {trail.join('  ·  ')}
              </span>
            </nav>
          )}

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <PlayerChip key={profileVersion} onEdit={onEditName} />
            <SettingsMenu />
          </div>
        </div>
      </div>

      {/* dobbel messinglinje — tykk over, tynn under, som et tittelblad */}
      <div aria-hidden>
        <div style={{ height: 2, background: 'color-mix(in srgb, var(--brass) 55%, transparent)' }} />
        <div
          style={{
            height: 1,
            marginTop: 2,
            background: 'color-mix(in srgb, var(--brass) 28%, transparent)',
          }}
        />
      </div>
    </header>
  )
}
