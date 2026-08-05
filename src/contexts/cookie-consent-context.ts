import { createContext } from 'react'
import type { ConsentStatus } from '../lib/cookieConsent'

export interface CookieConsentContextValue {
  consent: ConsentStatus
  bannerVisible: boolean
  accept: () => void
  decline: () => void
  showBanner: () => void
  /** sletter alt som er lagret på enheten (navn, ledertavle, nivå, valg) */
  clearStoredData: () => void
}

export const CookieConsentContext = createContext<CookieConsentContextValue | null>(null)
