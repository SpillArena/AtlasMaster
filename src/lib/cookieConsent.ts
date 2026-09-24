import {
  consentStorage,
  declareStoredKeys,
  getConsent as sharedGetConsent,
  hasConsent as sharedHasConsent,
  setConsent as sharedSetConsent,
  type ConsentStatus,
} from '../account'

export type { ConsentStatus }

/*
 * Samtykket eies av src/account/consent.ts, som er felles for forsiden og alle
 * spillene: én nøkkel, ett svar for hele SpillArena. Denne fila er det samme
 * API-et som før, så resten av AtlasMaster ikke trenger å endres — men svaret,
 * og hva et nei betyr, bestemmes der.
 *
 * Et nei betyr ingenting på disken, ikke at ingenting virker: read/write under
 * går til minnet for resten av fanen. En spiller som har sagt nei, kan logge
 * inn, spille, og få fremgang og resultater lagret på kontoen sin.
 */
export { CONSENT_KEY } from '../account'

/**
 * Alt spillet lagrer på enheten. Listen er kilden til sannhet både for
 * opprydding når samtykke avslås og for «slett dataene mine» i innstillingene.
 */
export const PREFERENCE_KEYS = [
  'theme',
  'accent',
  'lang',
  'sound',
  'motion',
  'pace',
  'playerName',
  'leaderboard',
  'progress',
  // hvilken konto profilen sist tilhørte — se adoptRemoteProgress i game/progress.ts
  'progressOwner',
  // den gamle innloggingsnøkkelen, fra før kontoen ble felles
  'auth',
] as const

// meldes inn med en gang: et nei gitt på forsiden eller i et annet spill skal
// rydde bort det AtlasMaster har lagret, også før noe her har lest det
declareStoredKeys(PREFERENCE_KEYS)

export const getConsent = sharedGetConsent
export const hasConsent = sharedHasConsent

export function setConsent(status: Exclude<ConsentStatus, null>): void {
  sharedSetConsent(status)
}

export function readPreference(key: string): string | null {
  return consentStorage.get(key)
}

export function writePreference(key: string, value: string): void {
  consentStorage.set(key, value)
}

/** Fjerner alt spillet har lagret, men beholder selve samtykkevalget. */
export function clearPreferences(): void {
  for (const key of PREFERENCE_KEYS) consentStorage.remove(key)
}
