import { createProfileSync, getSession } from '../account'
import { hasConsent } from '../lib/cookieConsent'
import { adoptRemoteProgress, getProgress } from './progress'
import type { Progress } from './progress'

/**
 * Kobler kontoen og den lokale profilen sammen, i begge retninger.
 *
 * Selve mekanikken — når det hentes, når det skyves — ligger i
 * src/account/sync.ts, som er lik i alle spillene. Det AtlasMaster eier er
 * SMELTINGA: bare dette spillet vet at hvert felt i `Progress` er en sum eller
 * en rekord som bare kan vokse, og at det derfor er trygt å ta det høyeste av
 * hvert par. Se `mergeProgress` og `adoptRemoteProgress` i progress.ts — det
 * siste håndterer også kontobytte på samme enhet, som en ren smelting ville
 * limt to spilleres statistikk sammen på.
 *
 * Uten samtykke skjer ingenting: profilen ville ikke overlevd fanen uansett,
 * og en konto som får halve historien er verre enn en som får ingen.
 */
/*
 * Navnet smeltingen tilhører. adoptRemoteProgress trenger det for å se om
 * profilen på enheten er den samme spillerens som kontoen — det leses fra
 * økten i stedet for å gis inn, fordi en henting kan skje i en annen fane enn
 * den som logget inn.
 */
const ownerName = (): string => getSession()?.username ?? ''

const sync = createProfileSync<Progress>({
  game: 'atlasmaster',
  read: getProgress,
  merge: (_local, remote) => adoptRemoteProgress(ownerName(), remote),
  // adoptRemoteProgress lagrer selv, og er den som avgjør hva som blir stående
  write: () => {},
})

/** Henter kontoens profil, smelter den inn, og skriver resultatet tilbake. */
export async function syncProgress(): Promise<void> {
  if (!hasConsent()) return
  await sync.pull()
}

/** Sender den ferske lokale profilen til kontoen — kalles etter en fullført runde. */
export function pushProgress(): void {
  if (!hasConsent()) return
  sync.push()
}

/** Henter på nytt når kontoen byttes, også når byttet skjedde i en annen fane. */
export function watchProgressSync(): () => void {
  return sync.watch()
}
