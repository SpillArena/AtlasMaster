import { useTranslation } from 'react-i18next'
import { ConsentDialog, type ConsentItem } from '../account'

/** Hva AtlasMaster lagrer, med ord en spiller forstår. Se ConsentDialog. */
const ITEMS: ConsentItem[] = [
  {
    no: { title: 'Fremgangen din i AtlasMaster', body: 'XP, nivå, rekorder og statistikk, så du ser dem igjen neste gang – også uten å logge inn.' },
    en: { title: 'Your progress in AtlasMaster', body: 'Your XP, level, records and stats, so you see them again next time – even without signing in.' },
  },
  {
    no: { title: 'Navnet ditt og dine resultater', body: 'Navnet du spiller under, og resultatene dine på denne enheten.' },
    en: { title: 'Your name and your results', body: 'The name you play under, and your results on this device.' },
  },
  {
    no: { title: 'Innstillingene dine', body: 'Tema, farge, språk, lyd, animasjoner og tempo.' },
    en: { title: 'Your settings', body: 'Theme, color, language, sound, animations and pace.' },
  },
]

/*
 * Samtykkedialogen er felles for hele SpillArena (src/account/ConsentDialog.tsx):
 * samme spørsmål, samme svar, samme utseende i alle spillene. Her bestemmes bare
 * hva AtlasMaster lagrer og hvilket språk den snakker.
 */
export default function CookieConsentBanner() {
  const { i18n } = useTranslation()
  return <ConsentDialog game="AtlasMaster" language={i18n.language} items={ITEMS} />
}
