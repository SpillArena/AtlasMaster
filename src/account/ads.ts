import { getConsent, setConsent } from './consent'

/**
 * Google AdSense, and Google's consent message, for the pages that show ads.
 *
 * TWO QUESTIONS, ONE PROMPT. SpillArena asks one thing of its own: may it keep
 * the sign-in and settings in this browser (consent.ts). Ads ask another: may
 * Google and its partners use cookies to show, measure and personalise ads. In
 * the EEA, the UK and Switzerland Google only serves personalised ads when that
 * second answer comes from a Google-certified consent platform speaking IAB
 * TCF, so our own dialog cannot ask it. Google's free one does — it arrives with
 * the AdSense tag, once a European regulations message is published under
 * Privacy & messaging in AdSense.
 *
 * Showing both on a first visit would be two walls before the first game, so on
 * a page with ads Google's message goes first and ours waits:
 *
 * - Google's message is shown, or was answered on an earlier visit: our dialog
 *   does not open by itself. If SpillArena's own question has no answer yet, it
 *   takes Google's answer to TCF purpose 1, "store and/or access information on
 *   a device" — the same question in other words. A "no" there is a "no" here,
 *   and the strip saying progress is not being saved offers a way to turn it on.
 *   After that the two answers are separate: changing one never changes the
 *   other.
 * - No message comes: no publisher id, the tag blocked by an ad blocker or the
 *   CSP, outside the regions Google asks in, or nothing within WAIT_MS. Our
 *   dialog asks, exactly as on a page without ads.
 *
 * A page without ads never calls loadAdSense(), and everything here stays 'off'.
 *
 * Which pages may show ads is decided by the page, not here. SipZone (alcohol
 * and snus) falls under Google's publisher restrictions, and MelodyRush and
 * Hitline depend on Deezer's terms for non-commercial use, so those three do not
 * call loadAdSense(). See docs/OPERATIONS.md in SpillArena.
 */

/** 'off': our dialog asks. 'waiting': the tag is loading. 'google': Google's message asks. */
export type AdConsentState = 'off' | 'waiting' | 'google'

interface TcData {
    gdprApplies?: boolean
    eventStatus?: 'tcloaded' | 'cmpuishown' | 'useractioncomplete'
    purpose?: { consents?: Record<string, boolean> }
}

type TcfApi = (
    command: 'addEventListener',
    version: number,
    callback: (data: TcData | null, success: boolean) => void,
) => void

interface GoogleFc {
    callbackQueue?: { push(entry: unknown): unknown }
    showRevocationMessage?: () => void
}

declare global {
    interface Window {
        __tcfapi?: TcfApi
        googlefc?: GoogleFc
    }
}

/** An AdSense publisher id, as AdSense shows it. Anything else is a typo. */
export const ADSENSE_CLIENT_PATTERN = /^ca-pub-\d{16}$/

const TAG = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

/**
 * How long our dialog waits for Google's message before asking itself. Long
 * enough for the tag on a slow phone, short enough that a blocked tag does not
 * leave a first-time visitor without a question for long. Should Google's
 * message turn up later after all, ours steps aside (see ConsentDialog).
 */
const WAIT_MS = 4000

type Listener = (state: AdConsentState) => void
const listeners = new Set<Listener>()
let state: AdConsentState = 'off'
let loaded = false

function update(next: AdConsentState): void {
    if (next === state) return
    state = next
    for (const listener of listeners) listener(next)
}

export function getAdConsentState(): AdConsentState {
    return state
}

/** Whether this page asked for ads — even if they were blocked or never came. */
export function adsRequested(): boolean {
    return loaded
}

export function onAdConsentStateChange(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/**
 * Loads the AdSense tag, and Google's consent message with it. Call it once,
 * before the first render, with the page's publisher id. An empty or missing id
 * is the switch that keeps ads off, so a build without one behaves as before.
 */
export function loadAdSense(client: string | undefined): void {
    if (loaded || typeof window === 'undefined' || typeof document === 'undefined') return
    const id = client?.trim()
    if (!id) return
    if (!ADSENSE_CLIENT_PATTERN.test(id)) {
        console.warn(`AdSense: "${id}" is not a publisher id (ca-pub- and 16 digits); ads stay off.`)
        return
    }
    loaded = true
    update('waiting')

    const timer = window.setTimeout(() => {
        if (state === 'waiting') update('off')
    }, WAIT_MS)
    const settle = (next: AdConsentState) => {
        window.clearTimeout(timer)
        update(next)
    }

    // Google's documented way in: a queue that exists before the tag does,
    // drained by the tag once its consent API is defined
    const fc = (window.googlefc ??= {})
    fc.callbackQueue ??= []
    fc.callbackQueue.push({
        CONSENT_API_READY: () => {
            const tcf = window.__tcfapi
            if (typeof tcf !== 'function') return
            tcf('addEventListener', 2.2, (data, success) => {
                if (!success || !data) return
                if (data.gdprApplies === false) {
                    // outside the regions Google asks in: our dialog asks
                    settle('off')
                    return
                }
                if (data.eventStatus === 'cmpuishown') {
                    settle('google')
                } else if (data.eventStatus === 'tcloaded' || data.eventStatus === 'useractioncomplete') {
                    settle('google')
                    if (getConsent() === null) {
                        setConsent(data.purpose?.consents?.['1'] === true ? 'accepted' : 'declined')
                    }
                }
            })
        },
    })

    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `${TAG}?client=${encodeURIComponent(id)}`
    // an ad blocker or the CSP: no message is coming, so do not keep our dialog waiting
    script.addEventListener('error', () => settle('off'))
    document.head.appendChild(script)
}

/** Opens Google's consent message again, so the ad choice can be changed. */
export function openAdSettings(): void {
    if (typeof window === 'undefined') return
    window.googlefc?.callbackQueue?.push(() => window.googlefc?.showRevocationMessage?.())
}
