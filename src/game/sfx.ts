/**
 * Syntetiserte lydeffekter via WebAudio — ingen lydfiler å laste, ingen
 * forsinkelse første gang. Konteksten opprettes først ved første avspilling,
 * som alltid skjer etter et brukertrykk (autoplay-reglene krever det).
 */

export type SfxName = 'correct' | 'wrong' | 'combo' | 'finish' | 'tick' | 'ui'

let enabled = true
let ctx: AudioContext | null = null

export function setSfxEnabled(value: boolean): void {
  enabled = value
}

function audio(): AudioContext | null {
  if (!enabled) return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface ToneOptions {
  freq: number
  /** sluttfrekvens for glissando — utelates for ren tone */
  to?: number
  start: number
  duration: number
  gain: number
  type: OscillatorType
}

function tone(ac: AudioContext, o: ToneOptions): void {
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  const t0 = ac.currentTime + o.start

  osc.type = o.type
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.duration)

  // rask attack, myk release — unngår klikk i høyttaleren
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + o.duration)

  osc.connect(amp).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + o.duration + 0.02)
}

/**
 * @param combo antall riktige på rad — hever tonehøyden så lyden stiger med
 * rekka. Brukes av 'correct' og 'combo'.
 */
export function playSfx(name: SfxName, combo = 0): void {
  const ac = audio()
  if (!ac) return
  const step = Math.min(combo, 12)

  switch (name) {
    case 'correct': {
      const root = 523.25 * Math.pow(2, step / 24)
      tone(ac, { freq: root, start: 0, duration: 0.09, gain: 0.16, type: 'triangle' })
      tone(ac, { freq: root * 1.5, start: 0.07, duration: 0.13, gain: 0.13, type: 'triangle' })
      break
    }
    case 'combo': {
      const root = 659.25 * Math.pow(2, step / 24)
      tone(ac, { freq: root, start: 0, duration: 0.07, gain: 0.12, type: 'square' })
      tone(ac, { freq: root * 1.26, start: 0.06, duration: 0.07, gain: 0.11, type: 'square' })
      tone(ac, { freq: root * 2, start: 0.12, duration: 0.16, gain: 0.1, type: 'triangle' })
      break
    }
    case 'wrong':
      tone(ac, { freq: 180, to: 90, start: 0, duration: 0.22, gain: 0.18, type: 'sawtooth' })
      break
    case 'finish':
      tone(ac, { freq: 523.25, start: 0, duration: 0.14, gain: 0.15, type: 'triangle' })
      tone(ac, { freq: 659.25, start: 0.13, duration: 0.14, gain: 0.15, type: 'triangle' })
      tone(ac, { freq: 783.99, start: 0.26, duration: 0.16, gain: 0.15, type: 'triangle' })
      tone(ac, { freq: 1046.5, start: 0.41, duration: 0.5, gain: 0.17, type: 'triangle' })
      break
    case 'tick':
      tone(ac, { freq: 1200, start: 0, duration: 0.04, gain: 0.07, type: 'square' })
      break
    case 'ui':
      tone(ac, { freq: 420, start: 0, duration: 0.05, gain: 0.06, type: 'sine' })
      break
  }
}
