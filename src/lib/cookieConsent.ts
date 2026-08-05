export type ConsentStatus = 'accepted' | 'declined' | null

export const CONSENT_KEY = 'cookie-consent'

/**
 * Alt spillet lagrer på enheten. Listen er kilden til sannhet både for
 * opprydding når samtykke avslås og for oversikten i personvern-panelet.
 */
export const PREFERENCE_KEYS = [
  'theme',
  'accent',
  'lang',
  'sound',
  'haptics',
  'motion',
  'pace',
  'playerName',
  'leaderboard',
  'progress',
] as const

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function getConsent(): ConsentStatus {
  const stored = storage()?.getItem(CONSENT_KEY)
  return stored === 'accepted' || stored === 'declined' ? stored : null
}

export function hasConsent(): boolean {
  return getConsent() === 'accepted'
}

export function setConsent(status: Exclude<ConsentStatus, null>): void {
  storage()?.setItem(CONSENT_KEY, status)
}

export function readPreference(key: string): string | null {
  if (!hasConsent()) return null
  try {
    return storage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writePreference(key: string, value: string): void {
  if (!hasConsent()) return
  try {
    storage()?.setItem(key, value)
  } catch {
    /* full eller blokkert storage — valget gjelder fortsatt for økten */
  }
}

/** Fjerner alt spillet har lagret, men beholder selve samtykkevalget. */
export function clearPreferences(): void {
  const store = storage()
  if (!store) return
  for (const key of PREFERENCE_KEYS) {
    try {
      store.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}
