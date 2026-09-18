/**
 * Innlogging — nå kontoen som gjelder hele SpillArena.
 *
 * Denne fila var selve innlogginga: den snakket med AtlasMaster sin egen
 * /api/auth og lagret økten under nøkkelen 'auth'. Begge deler er flyttet til
 * forsiden. Spillene ligger på samme opphav — spillarena.no/<spill> er en
 * router som strippar prefikset — så tegnet forsiden skriver, leser dette
 * spillet uten et eneste kall. Én innlogging, fem spill.
 *
 * Det som står igjen her er koblingen mot resten av AtlasMaster: at tavla og
 * profilen følger navnet på kontoen man faktisk er i. Resten er
 * gjennomstikk til src/account/, som er lik i alle spillene.
 *
 * Kontoene og PIN-ene er de samme radene som før — se
 * SpillArena/scripts/migrate-atlasmaster-accounts.mjs — og tegnene som alt var
 * utstedt er fortsatt gyldige så lenge forsiden signerer med samme AUTH_SECRET.
 */

import { hasConsent } from '../lib/cookieConsent'
import {
  adoptLegacySession,
  authenticate as authenticateAccount,
  configureSession,
  onSessionChange,
} from '../account'
import { setName } from './leaderboard'

export type { AuthAction, AuthResult, Session } from '../account'
export { forgetSession, getSession, isSignedIn, onSessionChange, signOut } from '../account'

/** Nøkkelen økten lå under før kontoene ble felles. */
const LEGACY_STORAGE_KEY = 'auth'

let started = false

/**
 * Kobler økten til AtlasMaster. Kalles én gang ved oppstart.
 *
 * Rekkefølgen er ikke tilfeldig: samtykket må være satt før noe leses, ellers
 * cacher session.ts en tom økt før den får lov til å lese lageret.
 */
export function initAuth(): void {
  if (started) return
  started = true

  configureSession({ hasConsent })
  adoptLegacySession(LEGACY_STORAGE_KEY)

  // tavla og profilen leser navnet herfra og skal følge kontoen man er i —
  // også når byttet skjedde på forsiden, i en annen fane
  onSessionChange((session) => {
    if (session) setName(session.username)
  })
}

/**
 * Registrerer eller logger inn mot forsidens kontotjeneste.
 *
 * PIN-en forlater aldri dette laget: den sendes én gang for å få et signert
 * tegn tilbake, og tegnet er det eneste som lagres.
 */
export async function authenticate(
  action: 'register' | 'login',
  username: string,
  pin: string,
) {
  const result = await authenticateAccount(action, username, pin)
  if (result.ok) setName(result.session.username)
  return result
}
