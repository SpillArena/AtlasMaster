/**
 * Kontoar for AtlasMaster: brukarnamn og PIN.
 *
 * POST /api/auth  { action: 'register' | 'login', username, pin }
 *   → 200 { username, token, expiresAt }
 *   → 4xx { error: <kode> }
 *
 * Feilkodene er stabile strengar og ikkje setningar. Klienten skal kunne
 * omsetje dei; ei engelsk setning frå ein Worker kan han berre vise fram.
 *
 * KVIFOR I DET HEILE. Tavla identifiserte ein spelar med ein streng frå eit
 * tekstfelt. Kven som helst kunne sende inn eit resultat under kva namn som
 * helst, og sidan spørjinga held éi rad per brukarnamn, ville ein høgare falsk
 * poengsum ERSTATTE raden til den verkelege spelaren i staden for å leggje seg
 * ved sida av. Ein topplassering var ikkje verd noko, fordi ho ikkje var
 * knytt til nokon.
 *
 * KVA EIN PIN FAKTISK VERNAR. Fire til seks siffer er ti tusen til ein million
 * moglege verdiar. Ingen nøkkelutleiingsfunksjon gjer det talet stort. Det som
 * stoppar gjeting er GRENSA PÅ FORSØK — fem feil, så er kontoen stengd eit
 * kvarter — og nøkkelutleiinga er der for det andre tilfellet: lek databasen
 * ut, skal ikkje alle PIN-ane vere lesbare med eitt oppslag. Begge trengst;
 * ingen av dei aleine er nok. Dette er ein spelkonto på ei poengtavle, ikkje
 * ein bankkonto, og det er det tryggingsnivået som er valt.
 */

const PIN_MIN = 4
const PIN_MAX = 6
const USERNAME_MAX = 20

/** Kor lenge ei innlogging varer. */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Feil på rad før kontoen blir stengd, og kor lenge han er stengd. */
const MAX_FAILED = 5
const LOCKOUT_MS = 15 * 60 * 1000

/**
 * Rundar i PBKDF2.
 *
 * Talet er sett av CPU-taket i ein Pages Function, ikkje av kryptografi:
 * hundre tusen rundar er vanleg for passord, men brukar titals millisekund, og
 * gratisplanen gjev ti. Tjuefem tusen ligg innanfor og er framleis fire
 * tideler av eit sekund for kvar million gjetingar på ein lekk database.
 *
 * For ein PIN på fire siffer er dette uansett det minst viktige leddet — sjå
 * merknaden om forsøksgrensa øvst. Talet kan settast opp om prosjektet ein dag
 * ligg på ein betalt plan.
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
 * Samanlikning som brukar like lang tid uansett kvar det første avviket er.
 *
 * `a === b` på ein signatur fortel ein tolmodig angripar kor mange teikn som
 * stemte, eitt teikn om gongen. Det er ein lang veg frå praktisk her, men det
 * er ei linje kode.
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
 * Eit teikn er `base64url(payload).signatur`.
 *
 * Payloaden er lesbar for alle — han er ikkje hemmeleg, berre signert. Det som
 * ikkje kan forfalskast er signaturen, og han dekkjer både namnet og
 * utløpstida, så korkje kven du er eller kor lenge kan endrast utan nøkkelen.
 */
export async function issueToken(secret, username, now = Date.now()) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ u: username, e: now + TOKEN_TTL_MS })))
  return `${payload}.${await hmac(secret, payload)}`
}

/** Brukarnamnet i eit gyldig teikn, eller null. Kastar aldri. */
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
  // ingen kontroll- eller formateringsteikn: eit namn på ei tavle skal vere
  // det same namnet uansett kva som renderer det
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(trimmed)) return 'bad_username'
  if (typeof pin !== 'string' || !new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)) {
    return 'bad_pin'
  }
  return null
}

export async function onRequestPost(context) {
  const { env, request } = context

  /*
   * Utan nøkkel kan ingen teikn signerast, og då er det einaste ærlege svaret
   * at tenesta ikkje er sett opp. Å falle tilbake på noko som ser ut til å
   * virke ville gitt kontoar ingen ting vernar.
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
     * «Finst ikkje» og «feil PIN» får same svar med vilje. Skil ein dei, blir
     * innloggingsskjemaet ei liste over kven som spelar.
     */
    if (!existing) return json({ error: 'bad_credentials' }, 401)

    if (existing.locked_until && existing.locked_until > nowIso) {
      return json({ error: 'locked' }, 429)
    }

    const attempted = await hashPin(pin, existing.pin_salt)
    if (!timingSafeEqual(attempted, existing.pin_hash)) {
      const failed = (existing.failed ?? 0) + 1
      // femte feil stenger kontoen eit kvarter — det er dette, og ikkje
      // rundetalet i PBKDF2, som gjer ein PIN på fire siffer verd noko
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
