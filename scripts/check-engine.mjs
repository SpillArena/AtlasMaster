/**
 * Røyktest av spelmotoren.
 *
 *   npm run check:engine
 *
 * Reglane i `src/game/quizReducer.ts` er dei som avgjer om spelet er
 * rettferdig, og dei er vanskelege å sjå etter i ein nettlesar: du må bomme
 * på rett stad til rett tid for å nå dei. Her blir dei køyrde direkte.
 *
 * Testen dekkjer det som lettast går gale:
 *   - eit sted som er svart riktig kan aldri koste poeng igjen
 *   - eit bomma sted kjem tilbake i køen, men ikkje for alltid
 *   - poengsummen kan ikkje gå under null
 *   - skrivemodus er verdt meir enn klikking for same svar
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
  if (!ok) console.log(`        venta ${JSON.stringify(expected)}, fekk ${JSON.stringify(actual)}`)
}

const start = (mode = 'click', pace = 'normal') => init({ features, mode, pace })
const send = (state, ...actions) => actions.reduce((s, a) => reducer(s, a, features), state)

/** Ei feature som ikkje er målet akkurat no. */
const other = (state) => features.find((f) => f.id !== state.queue[0]).id

// --- eit løyst sted er ute av spelet -----------------------------------
{
  let s = start()
  const first = s.queue[0]
  s = send(s, { t: 'GUESS', id: first })
  check('riktig svar blir markert', s.status[first], 'correct')

  const pointsAfterHit = s.points
  const mistakesAfterHit = s.mistakes
  s = send(s, { t: 'GUESS', id: first })
  check('klikk på eit løyst sted gjev ingen poengendring', s.points, pointsAfterHit)
  check('klikk på eit løyst sted tel ikkje som feil', s.mistakes, mistakesAfterHit)
  check('klikk på eit løyst sted rører ikkje rekka', s.streak, 1)
}

// --- bomskot: fasit fram, og staden tilbake i køen ----------------------
{
  let s = start()
  const target = s.queue[0]
  const wrong = other(s)
  s = send(s, { t: 'GUESS', id: wrong })

  check('bomskot set spelet i avsløringsfasen', s.phase, 'reveal')
  check('fasiten peikar på målet', s.reveal.id, target)
  check('bomskotet blinkar på det som blei treft', s.flash.id, wrong)
  check('bomskot tel som feil', s.mistakes, 1)
  check('målet er ikkje markert som løyst', s.status[target], undefined)

  const during = send(s, { t: 'GUESS', id: other(s) })
  check('ingen svar blir tekne imot medan fasiten står framme', during.mistakes, 1)

  s = send(s, { t: 'CONTINUE' })
  check('spelet går vidare etter fasiten', s.phase, 'playing')
  check('det bomma stedet står framleis i køen', s.queue.includes(target), true)
  check('men det er ikkje målet no', s.queue[0] === target, false)
  check('køen er like lang som før', s.queue.length, features.length)
}

// --- eit sted kjem ikkje tilbake for alltid ----------------------------
{
  let s = start()
  const target = s.queue[0]
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    // spol køen fram til det same stedet er målet igjen
    while (s.queue[0] !== target) s = send(s, { t: 'SKIP' })
    s = send(s, { t: 'GUESS', id: other(s) }, { t: 'CONTINUE' })
  }
  check(`etter ${MAX_ATTEMPTS} bom blir stedet avslørt for godt`, s.status[target], 'revealed')
  check('og er ute av køen', s.queue.includes(target), false)
  check('forsøka er talde', s.attempts[target], MAX_ATTEMPTS)
  check('og stedet står på lista over det som rauk', s.missed, [target])
}

// --- poengsummen kan ikkje gå under null -------------------------------
{
  let s = start()
  for (let i = 0; i < 10; i++) {
    s = send(s, { t: 'GUESS', id: other(s) }, { t: 'CONTINUE' })
  }
  check('poengsummen stoppar på null', s.points, 0)
}

// --- modusane er ikkje like mykje verdt --------------------------------
{
  const hit = (mode) => {
    const s = start(mode)
    return send(s, { t: 'GUESS', id: s.queue[0] }).points
  }
  const click = hit('click')
  const choice = hit('choice')
  check('skrivemodus er verdt meir enn klikking', hit('type') > click, true)
  check('flervalg er verdt mindre enn klikking', choice < click, true)
  check(
    'forholdet følgjer MODE_MULTIPLIER',
    Math.round((hit('type') / click) * 100) / 100,
    MODE_MULTIPLIER.type / MODE_MULTIPLIER.click,
  )
}

// --- skrivemodus godtek engelsk namn og éin slurvefeil -----------------
{
  const s = start('type')
  const target = features.find((f) => f.id === s.queue[0])
  check('rett skrivemåte tel', send(s, { t: 'TYPE', text: target.name }).status[target.id], 'correct')
  check('tom tekst er ikkje eit svar', send(s, { t: 'TYPE', text: '  ' }).phase, 'reveal')
}

// --- runden endar når køen er tom --------------------------------------
{
  let s = start()
  while (s.phase === 'playing') s = send(s, { t: 'GUESS', id: s.queue[0] })
  check('runden er ferdig', s.phase, 'finished')
  check('alle stader er løyste', Object.keys(s.status).length, features.length)
  check('ingenting rauk', s.missed, [])
  check('rekka er heil', s.bestStreak, features.length)
}

console.log(failures === 0 ? '\nAlle sjekkar gjekk gjennom.' : `\n${failures} sjekk(ar) feila.`)
process.exit(failures === 0 ? 0 : 1)
