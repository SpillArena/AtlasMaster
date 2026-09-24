import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CookieConsentContext } from './cookie-consent-context'
import { clearPreferences, getConsent, setConsent as persistConsent, type ConsentStatus } from '../lib/cookieConsent'
import { onConsentChange, openConsentDialog } from '../account'

/*
 * Speiler det felles samtykket (src/account/consent.ts) i React. Selve
 * spørsmålet stilles av ConsentDialog, som er lik i alle spillene; denne gir
 * innstillingsmenyen og spillskjermen svaret, og en vei tilbake til dialogen.
 */
export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentStatus>(getConsent)

  // svar gitt i dialogen, på forsiden eller i et annet spill i en annen fane
  useEffect(() => onConsentChange(setConsent), [])

  function accept() {
    persistConsent('accepted')
  }

  function decline() {
    // consent.ts rydder bort alt som er meldt inn, også økten på disken
    persistConsent('declined')
  }

  function showBanner() {
    openConsentDialog()
  }

  function clearStoredData() {
    clearPreferences()
  }

  return (
    <CookieConsentContext.Provider value={{ consent, accept, decline, showBanner, clearStoredData }}>
      {children}
    </CookieConsentContext.Provider>
  )
}
