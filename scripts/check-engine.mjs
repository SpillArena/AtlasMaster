/**
 * Røyktest av spillmotoren.
 *
 *   npm run check:engine
 *
 * Reglene i `src/game/quizReducer.ts` er de som avgjør om spillet er
 * rettferdig, og de er vanskelige å se etter i en nettleser: du må bomme
 * på rett sted til rett tid for å nå dem. Her blir de kjørt direkte.
 *
 * Testen dekker det som lettest går galt:
 *   - et sted som er svart riktig kan aldri koste poeng igjen
 *   - et bommet sted kommer tilbake i køen, men ikke for alltid
 *   - poengsummen kan ikke gå under null
 *   - skrivemodus er verdt mer enn klikking for samme svar
 */

import { init, reducer } from '../src/game/quizReducer.ts'
import { MAX_ATTEMPTS, MODE_MULTIPLIER } from '../src/game/scoring.ts'

const features = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({
  id,
  name: id.toUpperCase(),
  aliases: [id.toUpperCase()],
  geometry: { type: 'Point', coordinates: [0, 0] },
}))

let failures = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`        ventet ${JSON.stringify(expected)}, fikk ${JSON.stringify(actual)}`)
}

const start = (mode = 'click', pace = 'normal') => init({ features, mode, pace })
const send = (state, ...actions) => actions.reduce((s, a) => reducer(s, a, features), state)

/** En feature som ikke er målet akkurat nå. */
const other = (state) => features.find((f) => f.id !== state.queue[0]).id

// --- et løst sted er ute av spillet -----------------------------------
{
  let s = start()
  const first = s.queue[0]
  s = send(s, { t: 'GUESS', id: first })
  check('riktig svar blir markert', s.status[first], 'correct')

  const pointsAfterHit = s.points
  const mistakesAfterHit = s.mistakes
  s = send(s, { t: 'GUESS', id: first })
  check('klikk på et løst sted gir ingen poengendring', s.points, pointsAfterHit)
  check('klikk på et løst sted teller ikke som feil', s.mistakes, mistakesAfterHit)
  check('klikk på et løst sted rører ikke rekka', s.streak, 1)
}

// --- bomskudd: fasit fram, og stedet tilbake i køen ----------------------
{
  let s = start()
  const target = s.queue[0]
  const wrong = other(s)
  s = send(s, { t: 'GUESS', id: wrong })

  check('bomskudd setter spillet i avsløringsfasen', s.phase, 'reveal')
  check('fasiten peker på målet', s.reveal.id, target)
  check('bomskuddet blinker på det som ble truffet', s.flash.id, wrong)
  check('bomskudd teller som feil', s.mistakes, 1)
  check('målet er ikke markert som løst', s.status[target], undefined)

  const during = send(s, { t: 'GUESS', id: other(s) })
  check('ingen svar blir tatt imot mens fasiten står framme', during.mistakes, 1)

  s = send(s, { t: 'CONTINUE' })
  check('spillet går videre etter fasiten', s.phase, 'playing')
  check('det bommede stedet står fortsatt i køen', s.queue.includes(target), true)
  check('men det er ikke målet nå', s.queue[0] === target, false)
  check('køen er like lang som før', s.queue.length, features.length)
}

// --- et sted kommer ikke tilbake for alltid ----------------------------
{
  let s = start()
  const target = s.queue[0]
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    // spol køen fram til det samme stedet er målet igjen
    while (s.queue[0] !== target) s = send(s, { t: 'SKIP' })
    s = send(s, { t: 'GUESS', id: other(s) }, { t: 'CONTINUE' })
  }
  check(`etter ${MAX_ATTEMPTS} bom blir stedet avslørt for godt`, s.status[target], 'revealed')
  check('og er ute av køen', s.queue.includes(target), false)
  check('forsøkene er talt', s.attempts[target], MAX_ATTEMPTS)
  check('og stedet står på lista over det som røk', s.missed, [target])
}

// --- poengsummen kan ikke gå under null -------------------------------
{
  let s = start()
  for (let i = 0; i < 10; i++) {
    s = send(s, { t: 'GUESS', id: other(s) }, { t: 'CONTINUE' })
  }
  check('poengsummen stopper på null', s.points, 0)
}

// --- modusene er ikke like mye verdt --------------------------------
{
  const hit = (mode) => {
    const s = start(mode)
    return send(s, { t: 'GUESS', id: s.queue[0] }).points
  }
  const click = hit('click')
  const choice = hit('choice')
  check('skrivemodus er verdt mer enn klikking', hit('type') > click, true)
  check('flervalg er verdt mindre enn klikking', choice < click, true)
  check(
    'forholdet følger MODE_MULTIPLIER',
    Math.round((hit('type') / click) * 100) / 100,
    MODE_MULTIPLIER.type / MODE_MULTIPLIER.click,
  )
}

// --- skrivemodus godtar engelsk navn og én slurvefeil -----------------
{
  const s = start('type')
  const target = features.find((f) => f.id === s.queue[0])
  check('rett skrivemåte teller', send(s, { t: 'TYPE', text: target.name }).status[target.id], 'correct')
  check('tom tekst er ikke et svar', send(s, { t: 'TYPE', text: '  ' }).phase, 'reveal')
}

// --- runden ender når køen er tom --------------------------------------
{
  let s = start()
  while (s.phase === 'playing') s = send(s, { t: 'GUESS', id: s.queue[0] })
  check('runden er ferdig', s.phase, 'finished')
  check('alle steder er løst', Object.keys(s.status).length, features.length)
  check('ingenting røk', s.missed, [])
  check('rekka er hel', s.bestStreak, features.length)
}

console.log(failures === 0 ? '\nAlle sjekker gikk gjennom.' : `\n${failures} sjekk(er) feilet.`)
process.exit(failures === 0 ? 0 : 1)
