/**
 * Kontoer for AtlasMaster: brukernavn og PIN.
 *
 * POST /api/auth  { action: 'register' | 'login', username, pin }
 *   → 200 { username, token, expiresAt }
 *   → 4xx { error: <kode> }
 *
 * Feilkodene er stabile strenger og ikke setninger. Klienten skal kunne
 * oversette dem; en engelsk setning fra en Worker kan den bare vise fram.
 *
 * HVORFOR I DET HELE. Tavla identifiserte en spiller med en streng fra et
 * tekstfelt. Hvem som helst kunne sende inn et resultat under hvilket navn som
 * helst, og siden spørringen holder én rad per brukernavn, ville en høyere falsk
 * poengsum ERSTATTE raden til den virkelige spilleren i stedet for å legge seg
 * ved siden av. En topplassering var ikke verdt noe, fordi den ikke var
 * knyttet til noen.
 *
 * HVA EN PIN FAKTISK VERNER. Fire til seks siffer er ti tusen til en million
 * mulige verdier. Ingen nøkkelutledningsfunksjon gjør det tallet stort. Det som
 * stopper gjeting er GRENSA PÅ FORSØK — fem feil, så er kontoen stengt et
 * kvarter — og nøkkelutledningen er der for det andre tilfellet: lekker databasen
 * ut, skal ikke alle PIN-ene være lesbare med ett oppslag. Begge trengs;
 * ingen av dem alene er nok. Dette er en spillkonto på en poengtavle, ikke
 * en bankkonto, og det er det sikkerhetsnivået som er valgt.
 */

const PIN_MIN = 4
const PIN_MAX = 6
const USERNAME_MAX = 20

/** Hvor lenge en innlogging varer. */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Feil på rad før kontoen blir stengt, og hvor lenge den er stengt. */
const MAX_FAILED = 5
const LOCKOUT_MS = 15 * 60 * 1000

/**
 * Rundar i PBKDF2.
 *
 * Tallet er satt av CPU-taket i en Pages Function, ikke av kryptografi:
 * hundre tusen runder er vanlig for passord, men bruker titalls millisekund, og
 * gratisplanen gir ti. Tjuefem tusen ligger innenfor og er fortsatt fire
 * tideler av et sekund for hver million gjetinger på en lekk database.
 *
 * For en PIN på fire siffer er dette uansett det minst viktige leddet — se
 * merknaden om forsøksgrensa øverst. Tallet kan settes opp om prosjektet en dag
 * ligger på en betalt plan.
 */
const PBKDF2_ROUNDS = 25000

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

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

/**
 * Sammenligning som bruker like lang tid uansett hvor det første avviket er.
 *
 * `a === b` på en signatur forteller en tålmodig angriper hvor mange tegn som
 * stemte, ett tegn om gangen. Det er en lang vei fra praktisk her, men det
 * er en linje kode.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hashPin(pin, saltB64) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(saltB64), iterations: PBKDF2_ROUNDS },
    key,
    256,
  )
  return toBase64Url(bits)
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

/**
 * Et tegn er `base64url(payload).signatur`.
 *
 * Payloaden er lesbar for alle — den er ikke hemmelig, bare signert. Det som
 * ikke kan forfalskes er signaturen, og den dekker både navnet og
 * utløpstida, så verken hvem du er eller hvor lenge kan endres uten nøkkelen.
 */
export async function issueToken(secret, username, now = Date.now()) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ u: username, e: now + TOKEN_TTL_MS })))
  return `${payload}.${await hmac(secret, payload)}`
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

function validate(username, pin) {
  if (typeof username !== 'string') return 'bad_username'
  const trimmed = username.trim()
  if (!trimmed || trimmed.length > USERNAME_MAX) return 'bad_username'
  // ingen kontroll- eller formateringstegn: et navn på en tavle skal være
  // det samme navnet uansett hva som renderer det
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(trimmed)) return 'bad_username'
  if (typeof pin !== 'string' || !new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)) {
    return 'bad_pin'
  }
  return null
}

export async function onRequestPost(context) {
  const { env, request } = context

  /*
   * Uten nøkkel kan ingen tegn signeres, og da er det eneste ærlige svaret
   * at tjenesten ikke er satt opp. Å falle tilbake på noe som ser ut til å
   * virke ville gitt kontoer ingen ting verner.
   */
  if (!env.AUTH_SECRET) {
    return json({ error: 'not_configured' }, 503)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad_body' }, 400)
  }

  const { action } = body
  if (action !== 'register' && action !== 'login') return json({ error: 'bad_action' }, 400)

  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const pin = body.pin
  const invalid = validate(username, pin)
  if (invalid) return json({ error: invalid }, 400)

  const now = new Date()
  const nowIso = now.toISOString()

  try {
    const existing = await env.DB.prepare(
      `SELECT username, pin_hash, pin_salt, failed, locked_until FROM players WHERE username = ?`,
    )
      .bind(username)
      .first()

    if (action === 'register') {
      if (existing) return json({ error: 'name_taken' }, 409)
      const salt = toBase64Url(crypto.getRandomValues(new Uint8Array(16)))
      await env.DB.prepare(
        `INSERT INTO players (username, pin_hash, pin_salt, created_at, last_seen)
         VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(username, await hashPin(pin, salt), salt, nowIso, nowIso)
        .run()
      return json({
        username,
        token: await issueToken(env.AUTH_SECRET, username, now.getTime()),
        expiresAt: now.getTime() + TOKEN_TTL_MS,
      })
    }

    /*
     * «Finnes ikke» og «feil PIN» får samme svar med vilje. Skiller en dem, blir
     * innloggingsskjemaet en liste over hvem som spiller.
     */
    if (!existing) return json({ error: 'bad_credentials' }, 401)

    if (existing.locked_until && existing.locked_until > nowIso) {
      return json({ error: 'locked' }, 429)
    }

    const attempted = await hashPin(pin, existing.pin_salt)
    if (!timingSafeEqual(attempted, existing.pin_hash)) {
      const failed = (existing.failed ?? 0) + 1
      // femte feil stenger kontoen et kvarter — det er dette, og ikke
      // rundetallet i PBKDF2, som gjør en PIN på fire siffer verdt noe
      const lockedUntil =
        failed >= MAX_FAILED ? new Date(now.getTime() + LOCKOUT_MS).toISOString() : null
      await env.DB.prepare(`UPDATE players SET failed = ?, locked_until = ? WHERE username = ?`)
        .bind(failed >= MAX_FAILED ? 0 : failed, lockedUntil, username)
        .run()
      return json({ error: 'bad_credentials' }, 401)
    }

    await env.DB.prepare(
      `UPDATE players SET failed = 0, locked_until = NULL, last_seen = ? WHERE username = ?`,
    )
      .bind(nowIso, username)
      .run()

    return json({
      username: existing.username,
      token: await issueToken(env.AUTH_SECRET, existing.username, now.getTime()),
      expiresAt: now.getTime() + TOKEN_TTL_MS,
    })
  } catch (error) {
    return json({ error: 'service_failed', details: String(error) }, 500)
  }
}
