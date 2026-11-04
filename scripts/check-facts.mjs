/** Independent country/capital coverage, locations, aliases and curated cities.
 * node --experimental-strip-types --import ./scripts/lib/ts-register.mjs scripts/check-facts.mjs
 * See docs/GEOGRAPHY_AUDIT.md for sources and inclusion rules. */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { geoContains, geoDistance } from 'd3-geo'
import { geographyReference as reference, majorCityReference, capitalFeatures, geographyAdditions } from './lib/geography-reference.mjs'
import { init, reducer } from '../src/game/quizReducer.ts'
import { toQuizFeatures } from '../src/game/types.ts'

const read = (file) => JSON.parse(readFileSync(resolve(file), 'utf8'))
const id = (value) => /^\d+$/.test(String(value)) ? String(value).padStart(3, '0') : String(value)
const playable = (fc) => fc.features.filter((f) => f.properties.playable !== false)
const ids = (features) => features.map((f) => id(f.properties.id)).sort()
const world = read('src/data/world/countries.json')
const worldById = new Map(world.features.map((f) => [id(f.properties.id), f]))
const expectedWorld = reference.countries.map((c) => c.id).sort()
assert.equal(reference.countries.filter((c) => c.status === 'member').length, 193)
assert.equal(reference.countries.filter((c) => c.status === 'observer').length, 2)
assert.equal(new Set(expectedWorld).size, 197)
assert.deepEqual(ids(playable(world)), expectedWorld, 'World roster must include every member, observer and explicit extra')
assert.deepEqual(ids(playable(read('src/data/world/outline.json'))), expectedWorld)

const flags = read('src/data/world/flags.json')
for (const country of reference.countries) {
  assert(flags[country.id] && existsSync(`src/data/world/flags/${flags[country.id]}.svg`), `Missing flag: ${country.name}`)
}

// Generalized coastlines can place coastal city points just outside land.
// Require correct-country land within 20 km, rather than accepting any nearby
// country's geometry. Exact coordinate snapshots separately guard relocations.
function onOrNear(land, [lon, lat]) {
  if (geoContains(land, [lon, lat])) return true
  const nearVertex = (coords) => typeof coords[0] === 'number'
    ? geoDistance([lon, lat], coords) * 6371 <= 20
    : coords.some(nearVertex)
  if (nearVertex(land.geometry.coordinates)) return true
  for (const km of [1, 3, 10, 20]) for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI / 16
    if (geoContains(land, [lon + Math.cos(angle) * km / (111.32 * Math.cos(lat * Math.PI / 180)), lat + Math.sin(angle) * km / 111.32])) return true
  }
  return false
}

for (const [region, capitals] of Object.entries(reference.capitals)) {
  const expectedCountries = reference.countries.filter((c) => c.regions.includes(region)).map((c) => c.id).sort()
  const countries = read(`src/data/${region}/countries.json`)
  assert.deepEqual(ids(playable(countries)), expectedCountries, `Missing/extra country in ${region}`)
  const actual = read(`src/data/${region}/capitals.json`)
  assert.deepEqual(actual.features, capitalFeatures(region), `Capital roster or coordinates drifted in ${region}; run data:geography`)
  assert.deepEqual([...new Set(actual.features.map((f) => f.properties.countryId))].sort(), expectedCountries,
    `A country has no capital/government-seat target in ${region}`)
  assert.equal(new Set(actual.features.map((f) => f.properties.id)).size, actual.features.length)
  for (const capital of capitals) {
    const land = worldById.get(capital.countryId)
    assert(onOrNear(land, capital.coordinates), `Capital far from its country: ${capital.nameEn}`)
    assert(capital.capitalRole, `Missing role: ${capital.nameEn}`)
  }
  console.log(`ok  ${region}: ${expectedCountries.length} countries, ${capitals.length} capital/seat targets, full country coverage`)
}

const countyCodes = ['03', '11', '15', '18', '31', '32', '33', '34', '39', '40', '42', '46', '50', '55', '56'].map(id).sort()
assert.deepEqual(ids(read('src/data/norway/counties.json').features), countyCodes, 'Norway must have all 15 current counties')
const stateCodes = '01 02 04 05 06 08 09 10 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56'.split(' ').map(id).sort()
assert.deepEqual(ids(read('src/data/usa/states.json').features), stateCodes, 'USA must have all 50 states')
for (const [region, expected] of Object.entries(majorCityReference.cities)) {
  const actual = read(`src/data/${region}/cities.json`)
  assert.deepEqual(actual.features, expected, `Major city roster drift: ${region}`)
  const country = worldById.get(region === 'norway' ? '578' : '840')
  assert.equal(new Set(actual.features.map((f) => f.properties.id)).size, actual.features.length)
  for (const f of actual.features) assert(onOrNear(country, f.geometry.coordinates), `City far from country: ${f.properties.name}`)
  console.log(`ok  ${region}: ${expected.length} selected major cities`)
}
const usCities = majorCityReference.cities.usa.map((f) => f.properties.name)
for (const name of ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','Jacksonville','Fort Worth','San Jose','Austin','Charlotte','Columbus','Indianapolis','San Francisco','Seattle','Denver','Oklahoma City']) {
  assert(usCities.includes(name), `Missing major US city: ${name}`)
}

// Official long names and local short names must both work in typing mode.
for (const region of ['world', ...Object.keys(reference.capitals)]) {
  const features = toQuizFeatures(read(`src/data/${region}/countries.json`), 'en')
  for (const feature of features) {
    const canonical = reference.countries.find((c) => c.id === id(feature.id)).name
    assert(feature.aliases.includes(canonical), `Official country name rejected: ${region}/${canonical}`)
  }
}

// Names and small islands alone cannot prove mainland coverage. These points
// catch the historical loss of Russia's main polygon and Fiji's Taveuni.
for (const file of ['world/countries', 'world/outline']) {
  const fc = read(`src/data/${file}.json`)
  const russia = fc.features.find((f) => id(f.properties.id) === '643')
  for (const point of [[37.6,55.75],[90,55],[170,65],[179,66],[-175,66]]) {
    assert(geoContains(russia, point), `Missing Russian mainland at ${point}: ${file}`)
  }
}
for (const file of ['world/countries','world/outline','oceania/countries','oceania/outline']) {
  const fiji = read(`src/data/${file}.json`).features.find((f) => id(f.properties.id) === '242')
  assert(geoContains(fiji, [-179.96,-16.84]), `Fiji's date-line island disappeared: ${file}`)
}

// Every spelling shipped to players must also be accepted by the real reducer.
for (const region of Object.keys(reference.capitals)) {
  const features = toQuizFeatures(read(`src/data/${region}/capitals.json`), 'en')
  for (const feature of features) for (const alias of feature.aliases) {
    const initial = init({ features: [feature], mode: 'type', pace: 'relaxed' })
    const result = reducer(initial, { t: 'TYPE', text: alias }, [feature])
    assert.equal(result.status[feature.id], 'correct', `Rejected valid spelling: ${alias}`)
  }
}
console.log('ok  country identities, capital locations, all shipped aliases, counties, states and date-line coverage')

for (const [dataset, additions] of Object.entries(geographyAdditions.datasets)) {
  const actual = read(`src/data/${dataset}.json`)
  for (const expected of additions) {
    assert.deepEqual(actual.features.find((f) => f.properties.id === expected.properties.id), expected,
      `Missing or changed physical feature: ${dataset}/${expected.properties.name}`)
  }
}
console.log('ok  Volga, Dnipro, Dniester and Elbrus are included')
