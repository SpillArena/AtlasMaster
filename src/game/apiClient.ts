/**
 * Delt oppslagslogikk mot Pages Functions-API-et.
 *
 * Ledertavla og profilen snakker med hver sin funksjon, men på nøyaktig samme
 * måte: prøv stiene i tur og orden til én svarer, skill «tjeneren er borte»
 * fra «tjeneren sa nei», og gi aldri et kall lenger enn TIMEOUT_MS. Dette lå
 * skrevet ut i scoreApi.ts alene før profilen trengte det samme — to kopier
 * av samme skille er én for mange.
 */

const TIMEOUT_MS = 6000

/**
 * Skillet mellom «serveren svarte ikke» og «serveren sa nei».
 *
 * Begge ble til `null` før: en avvist innsending og en død server så
 * identiske ut. Spilleren fikk vite at det ikke var noe der, i stedet for at
 * vi ikke fikk sett etter.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'unreachable' }
  | { ok: false; reason: 'rejected'; status: number; message?: string }

async function request(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(path, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Prøver hver kjente API-sti til én svarer. 404 betyr «feil sti», så da går
 * vi videre til neste; andre feil er tjenestens eget svar.
 */
export async function callApi<T>(
  paths: readonly string[],
  query: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  for (const base of paths) {
    try {
      const response = await request(`${base}${query}`, init)
      if (response.status === 404) continue
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        return { ok: false, reason: 'rejected', status: response.status, message: body?.error }
      }
      return { ok: true, data: (await response.json()) as T }
    } catch {
      continue
    }
  }
  return { ok: false, reason: 'unreachable' }
}
