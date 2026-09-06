import { readPreference, writePreference } from '../lib/cookieConsent'
import { setName } from './leaderboard'

/**
 * Innlogging: brukernavn og PIN.
 *
 * Navnet var en streng i et tekstfelt. Kven som helst kunne sende inn et
 * resultat under kva namn som helst, og siden tavla holder én rad per
 * brukernavn, ville en høyere falsk poengsum ERSTATTE raden til den virkelige
 * spilleren i stedet for å legge seg ved siden av. Se functions/api/auth/.
 *
 * PIN-en forlater aldri dette laget: den sendes én gang for å få et signert
 * teikn tilbake, og teiknet er det eneste som lagres. Ligger enheten åpen,
 * ligger ikke PIN-en der.
 */

const STORAGE_KEY = 'auth'
const API_PATHS = [`${import.meta.env.BASE_URL}api/auth`, '/api/auth']
const TIMEOUT_MS = 8000

export interface Session {
  username: string
  token: string
  /** millisekunder siden epoken */
  expiresAt: number
}

export type AuthAction = 'register' | 'login'

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; message: string }

/** Holder økten i live når samtykke er avslått — da lagres ingenting. */
let session: Session | null | undefined

function read(): Session | null {
  if (session !== undefined) return session
  try {
    const raw = readPreference(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Session) : null
    // et utgått teikn er like godt som ingen: da spør vi heller på nytt
    session = parsed && parsed.expiresAt > Date.now() ? parsed : null
  } catch {
    session = null
  }
  return session
}

export function getSession(): Session | null {
  return read()
}

export function isSignedIn(): boolean {
  return read() !== null
}

function store(next: Session | null): void {
  session = next
  writePreference(STORAGE_KEY, next ? JSON.stringify(next) : '')
  // tavla og profilen leser navnet herfra, og skal følge kontoen man er i
  if (next) setName(next.username)
}

export function signOut(): void {
  store(null)
}

/** Glemmer økten i minnet — kalles når lagrede data slettes. */
export function forgetSession(): void {
  session = undefined
}

/**
 * Registrerer eller logger inn. Feilmeldingen kommer fra tjeneren, som med
 * vilje svarer det samme på «finnes ikke» og «feil PIN»: skiller den dem, blir
 * innloggingsskjemaet en liste over hvem som spiller.
 */
export async function authenticate(
  action: AuthAction,
  username: string,
  pin: string,
): Promise<AuthResult> {
  for (const base of API_PATHS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, username, pin }),
        signal: controller.signal,
      })
      if (response.status === 404) continue
      const body = (await response.json().catch(() => null)) as Partial<Session> & {
        error?: string
      }
      if (!response.ok) return { ok: false, message: body?.error ?? 'failed' }
      if (!body?.token || !body.username || !body.expiresAt) {
        return { ok: false, message: 'failed' }
      }
      const next: Session = {
        username: body.username,
        token: body.token,
        expiresAt: body.expiresAt,
      }
      store(next)
      return { ok: true, session: next }
    } catch {
      continue
    } finally {
      clearTimeout(timer)
    }
  }
  return { ok: false, message: 'unreachable' }
}
