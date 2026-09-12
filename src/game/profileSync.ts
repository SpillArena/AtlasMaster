import { getSession, isSignedIn } from './auth'
import { hasConsent } from '../lib/cookieConsent'
import { fetchProfile, pushProfile } from './profileApi'
import { adoptRemoteProgress, getProgress } from './progress'

/**
 * Kobler kontoen og den lokale profilen sammen, i begge retninger.
 *
 * Kalles ved innlogging/registrering og ved oppstart når en økt fortsatt er
 * gyldig. Henter det kontoen har, smelter det inn i det enheten har (se
 * `adoptRemoteProgress` i progress.ts for hvorfor det ikke bare er en
 * erstatning), og skriver resultatet tilbake — det siste dekker både «kontoen
 * visste ikke om enhetens fremgang ennå» og «kontoen var alt oppdatert», som
 * begge blir en ufarlig oppdatering av samme rad.
 *
 * Kan kalles så ofte som helst uten fare: smeltingen kan bare vokse hvert
 * felt, aldri krympe det.
 */
export async function syncProgress(): Promise<void> {
  const session = getSession()
  if (!session || !hasConsent()) return

  const result = await fetchProfile()
  if (!result.ok) return

  const merged = adoptRemoteProgress(session.username, result.data.progress)
  void pushProfile(merged)
}

/**
 * Sender den ferske lokale profilen til kontoen — kalles rett etter en
 * fullført runde. Ren skyving, ingen henting: `syncProgress` har allerede
 * gjort opp med hvem profilen tilhører ved innlogging, så her er det bare å
 * dele det som står lokalt akkurat nå.
 */
export function pushProgress(): void {
  if (!isSignedIn() || !hasConsent()) return
  void pushProfile(getProgress())
}
