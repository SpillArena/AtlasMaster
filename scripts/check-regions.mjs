/** Exercise the real registry, lazy loaders, projections and score validator. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { geoContains } from 'd3-geo'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseEntry } from '../functions/api/leaderboard/index.js'

const read = (path) => JSON.parse(readFileSync(resolve(path), 'utf8'))
const locales = [read('src/i18n/locales/no.json'), read('src/i18n/locales/en.json')]
const flagMap = read('src/data/world/flags.json')
const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false, watch: null }, appType: 'custom' })

try {
  await server.ssrLoadModule('/src/i18n/index.ts')
  const { regions, getCategory } = await server.ssrLoadModule('/src/game/regions.ts')
  const { MODES, toQuizFeatures } = await server.ssrLoadModule('/src/game/types.ts')
  const { makeProjection, makePath, naturalAspect, mapFitData } = await server.ssrLoadModule('/src/game/projection.ts')
  const { init, reducer } = await server.ssrLoadModule('/src/game/quizReducer.ts')
  const { MapCanvas } = await server.ssrLoadModule('/src/components/game/MapCanvas.tsx')
  const { OCEAN_ANCHORS } = await server.ssrLoadModule('/src/game/oceanMap.ts')
  const ids = new Set()
  const sample = (region, category, mode, total) => ({
    region, category, mode, total, pace: 'relaxed', score: 0,
    correctCount: 0, mistakes: 0, bestStreak: 0, elapsedMs: 1000,
  })

  for (const region of regions) {
    assert(locales.every((l) => l.region[region.id]), `Missing region label: ${region.id}`)
    for (const category of region.categories) {
      assert(!ids.has(category.id), `Duplicate category: ${category.id}`)
      ids.add(category.id)
      const [data, base] = await Promise.all([category.load(), category.base?.()])
      const features = toQuizFeatures(data, 'en')
      assert(features.length > 0, `No answers: ${category.id}`)
      assert.equal(new Set(features.map((f) => f.id)).size, features.length)
      assert(features.every((f) => f.name && f.aliases.length), `Missing names: ${category.id}`)
      const fit = mapFitData(data, base, category.surface)
      const spec = category.projection ?? region.projection
      const aspect = naturalAspect(spec, fit)
      assert(Number.isFinite(aspect) && aspect > 0 && aspect < 5, `Invalid aspect: ${category.id}`)
      const width = 900 * aspect
      const projection = makeProjection(spec, fit, width, 900)
      const path = makePath(projection)
      for (const f of features) {
        const d = path(f.geometry)
        assert(d && !/NaN|Infinity/.test(d), `Undrawable answer: ${category.id}/${f.id}`)
        assert(path.centroid(f.geometry).every(Number.isFinite), `Invalid marker: ${category.id}/${f.id}`)
      }
      assert(locales.every((l) => l.tile[category.id] && l.cat[category.labelKey.split('.')[1]]),
        `Missing category translation: ${category.id}`)
      if (category.emblems === 'world') {
        assert(features.every((f) => flagMap[f.id]), `Missing flag id: ${category.id}`)
      }
      for (const mode of ['click', 'choice', 'type', 'flag', 'pick']) {
        const available = (category.modes ?? MODES).includes(mode)
        const result = parseEntry(sample(region.id, category.id, mode, features.length), 'Test')
        assert.equal(!result.error, available, `Leaderboard modes differ: ${category.id}/${mode}`)
      }
      if (['northAmerica', 'oceania', 'antarctica'].includes(region.id) || category.surface === 'water') {
        for (const mode of category.modes ?? MODES) {
          let state = init({ features, mode, pace: 'relaxed' })
          while (state.phase === 'playing') state = reducer(state, { t: 'GUESS', id: state.queue[0] }, features)
          assert.equal(state.phase, 'finished')
          assert.equal(Object.keys(state.status).length, features.length)
          assert.equal(state.mistakes, 0)
        }
      }
    }
    console.log(`ok  ${region.id}: ${region.categories.length} categories loaded, projected and validated`)
  }

  const counts = [
    ['northAmerica', 'northAmericaCountries', 23], ['northAmerica', 'northAmericaCapitals', 23],
    ['oceania', 'oceaniaCountries', 14], ['oceania', 'oceaniaCapitals', 14],
    ['antarctica', 'antarcticaStations', 8], ['antarctica', 'antarcticaPeaks', 6],
    ['world', 'worldOceans', 17],
  ]
  for (const [region, category, expected] of counts) {
    assert.equal(toQuizFeatures(await getCategory(region, category).load()).length, expected)
  }
  const oceans = await getCategory('world', 'worldOceans').load()
  const oceanLand = await getCategory('world', 'worldOceans').base()
  const markup = renderToStaticMarkup(createElement(MapCanvas, {
    projectionSpec: getCategory('world', 'worldOceans').projection,
    fitData: mapFitData(oceans, oceanLand, 'water'), baseData: oceanLand, features: toQuizFeatures(oceans),
    geom: 'polygon', surface: 'water', status: {}, flashId: null,
    highlightId: 'pacific', onPick: () => {},
  }))
  const blockingLand = markup.indexOf('pointer-events="all"')
  assert(blockingLand > markup.lastIndexOf('<path data-id="'), 'Land must be above every water polygon')
  assert(oceanLand.features.some((f) => f.properties.id === '010'), 'Antarctica missing from ocean map')
  const checks = [
    ['pacific', [-140, 20]], ['pacific', [170, 20]], ['pacific', [-130, -30]],
    ['atlantic', [-30, 20]], ['atlantic', [-20, -30]], ['indian', [80, -20]],
    ['arctic', [0, 80]], ['southern', [0, -65]], ['southern', [-120, -65]],
  ]
  for (const [id, point] of checks) {
    assert.deepEqual(oceans.features.filter((f) => geoContains(f, point)).map((f) => f.properties.id), [id],
      `Wrong or overlapping ocean at ${point}`)
  }
  const english = toQuizFeatures(oceans, 'en')
  const norwegian = toQuizFeatures(oceans, 'no')
  for (const f of english) {
    const no = norwegian.find((n) => n.id === f.id)
    assert(f.aliases.includes(no.name))
    let state = init({ features: [f], mode: 'type', pace: 'relaxed' })
    state = reducer(state, { t: 'TYPE', text: no.name }, [f])
    assert.equal(state.status[f.id], 'correct', `Norwegian water answer rejected: ${f.id}`)
    state = init({ features: [f], mode: 'type', pace: 'relaxed' })
    state = reducer(state, { t: 'TYPE', text: f.aliases.at(-1) }, [f])
    assert.equal(state.status[f.id], 'correct', `Water alias rejected: ${f.id}`)
  }

  assert.equal(regions.find((r) => r.id === 'world').categories.length, 3,
    'Known seas belong in the existing Oceans category')
  const seaChecks = [
    ['Mediterranean Sea', [20, 33]], ['Black Sea', [34, 43]], ['Red Sea', [38, 20]],
    ['Baltic Sea', [19, 57]], ['North Sea', [3, 56]], ['Caribbean Sea', [-75, 15]],
    ['Norwegian Sea', [5, 67]], ['South China Sea', [115, 15]], ['East China Sea', [125, 29]],
    ['Arabian Sea', [63, 15]], ['Bering Sea', [-170, 60]], ['Bering Sea', [175, 60]],
    ['Coral Sea', [155, -18]],
  ]
  for (const [name, point] of seaChecks) {
    const raw = oceans.features.find((f) => f.properties.nameEn === name)
    assert(raw, `Sea omitted: ${name}`)
    assert(geoContains(raw, point), `Sea is not at the expected location: ${name}`)
    assert(!oceanLand.features.some((f) => geoContains(f, point)), `Sea answer covered by land: ${name}`)
    assert.equal(oceans.features.filter((f) => geoContains(f, point)).at(-1), raw,
      `Sea click target covered by a larger ocean: ${name}`)
  }
  const solvedMarkup = renderToStaticMarkup(createElement(MapCanvas, {
    projectionSpec: getCategory('world', 'worldOceans').projection,
    fitData: mapFitData(oceans, oceanLand, 'water'), baseData: oceanLand, features: english,
    geom: 'polygon', surface: 'water', status: { norwegianSea: 'correct' }, flashId: null, onPick: () => {},
  }))
  const solvedSea = solvedMarkup.match(/<path\b[^>]*fill="var\(--success\)"[^>]*>/)?.[0]
  assert(solvedSea && !solvedSea.includes('pointer-events-none') && !solvedSea.includes('data-id='),
    'Answered sea must absorb clicks rather than expose the larger ocean underneath')

  for (const [id, point] of Object.entries(OCEAN_ANCHORS)) {
    assert(geoContains(oceans.features.find((f) => f.properties.id === id), point), `Water marker misplaced: ${id}`)
    assert(!oceanLand.features.some((f) => geoContains(f, point)), `Water marker placed on land: ${id}`)
  }
  // Europe's central meridian stays in the middle of the playable world map.
  const fit = mapFitData(oceans, oceanLand, 'water')
  const spec = getCategory('world', 'worldOceans').projection
  const width = 900 * naturalAspect(spec, fit)
  const projection = makeProjection(spec, fit, width, 900)
  assert(Math.abs(projection([15, 50])[0] - width / 2) < 1,
    'Oceans map is not centred on Europe')
  assert(markup.includes('var(--water-area-') && markup.includes('water-map'), 'Water boundaries lack visible fills')
  console.log(`ok  ${ids.size} unique categories; rounds, ocean/sea locations, water layers and bilingual answers work`)
} finally {
  await server.close()
}
