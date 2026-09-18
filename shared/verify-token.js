/**
 * Verifiserer et innloggingstegn fra SpillArena.
 *
 * Tegnene utstedes av forsiden (SpillArena/functions/api/auth/). Dette spillet
 * skal bare vite HVEM som sender inn en poengsum, og det trenger ikke
 * kontodatabasen for å svare på: tegnet er signert, og en signatur kan regnes
 * ut på nytt av alle som kjenner AUTH_SECRET. Ingen oppslag, ingen kall
 * mellom tjenestene, ingen delt database — det er dette som gjør én konto på
 * tvers av fem spill billig.
 *
 * FORUTSETNINGEN er at AUTH_SECRET her er NØYAKTIG den samme hemmeligheten som
 * på Pages-prosjektet til forsiden:
 *
 *   npx wrangler pages secret put AUTH_SECRET
 *
 * Er den ikke det, faller hver eneste innsending på 401 med et tegn som ser
 * helt riktig ut. Fila er en kopi av utregningen i
 * SpillArena/shared/account-server.js — endres signeringen der, må den endres
 * her.
 */

const encoder = new TextEncoder()

const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64Url = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** Like lang tid uansett hvor det første avviket er — se merknaden i forsidens kopi. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

/** Brukernavnet i et gyldig tegn, eller null. Kaster aldri. */
export async function verifyToken(secret, token, now = Date.now()) {
  if (!secret || typeof token !== 'string') return null
  const dot = token.indexOf('.')
  if (dot < 1) return null
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (!timingSafeEqual(signature, await hmac(secret, payload))) return null
  try {
    const { u, e } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)))
    if (typeof u !== 'string' || typeof e !== 'number' || e < now) return null
    return u
  } catch {
    return null
  }
}
