/**
 * Måleband for kartlaget.
 *
 *   node scripts/bench-map.mjs
 *
 * Skriver ut, per region:
 *   - hvor mange features og koordinatpunkt datasettet inneholder
 *   - hvor lang tid det tar å bygge kartet én gang (projeksjon + baner)
 *   - hvor mange SVG-noder kartet legger i DOM-en
 *   - hvor mange React-element som blir bygd på nytt per zoom-ramme
 *   - hvor mange ganger landmassen blir rasterisert per ramme
 *   - hvor mange punkt den brede sokkelstripa må strekes gjennom
 *   - hvor mange React-element spillet bygger per sekund mens det står stille
 *
 * De siste tallene er de som avgjør om kartet holder 60 fps: alt React lager på
 * nytt mens fingeren drar, må også sammenlignes og potensielt tegnes om, og
 * en bred strek koster omtrent lineært i antallet punkt den går gjennom.
 *
 * MERK — skriptet speiler rendermodellen i `MapCanvas.tsx`. Endrer du
 * lagdelingen der, må tabellene under følge etter, ellers måler du et kart
 * som ikke finnes.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  geoAlbersUsa,
  geoAzimuthalEqualArea,
  geoBounds,
  geoConicConformal,
  geoGraticule,
  geoPath,
} from 'd3-geo'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const H = 900
const RUNS = 20

const CASES = [
  {
    region: 'Norge',
    file: 'src/data/norway/counties.json',
    projection: { kind: 'conicConformal', parallels: [60, 70], rotate: -15 },
  },
  {
    region: 'Europa',
    file: 'src/data/europe/countries.json',
    projection: { kind: 'conicConformal', parallels: [35, 65], rotate: -10 },
  },
  {
    region: 'Asia',
    file: 'src/data/asia/countries.json',
    projection: { kind: 'azimuthalEqualArea', centre: [87, 22] },
  },
  { region: 'USA', file: 'src/data/usa/states.json', projection: { kind: 'albersUsa' } },
]

function fromSpec(spec) {
  switch (spec.kind) {
    case 'conicConformal':
      return geoConicConformal().parallels(spec.parallels).rotate([spec.rotate, 0])
    case 'azimuthalEqualArea':
      return geoAzimuthalEqualArea().rotate([-spec.centre[0], -spec.centre[1]])
    case 'albersUsa':
      return geoAlbersUsa()
  }
}

function countPoints(geometry) {
  const walk = (node) => (typeof node[0] === 'number' ? 1 : node.reduce((n, c) => n + walk(c), 0))
  return walk(geometry.coordinates)
}

/**
 * Speiling av `coarsen` i src/game/projection.ts — punktene blir tynnet ut etter
 * at de er projisert, så toleransen er i lerretsenheter.
 */
function coarsen(projection, tolerance) {
  return {
    stream(sink) {
      let lastX = 0
      let lastY = 0
      let atStart = true
      return projection.stream({
        point(x, y, z) {
          if (atStart || Math.abs(x - lastX) + Math.abs(y - lastY) >= tolerance) {
            atStart = false
            lastX = x
            lastY = y
            sink.point(x, y, z)
          }
        },
        lineStart() {
          atStart = true
          sink.lineStart()
        },
        lineEnd: () => sink.lineEnd(),
        polygonStart: () => sink.polygonStart(),
        polygonEnd: () => sink.polygonEnd(),
        sphere: () => sink.sphere?.(),
      })
    },
  }
}

/** Antallet koordinatpar i en SVG-banestreng. */
const pathPoints = (d) => (d.match(/[-\d.]+,[-\d.]+/g) ?? []).length

/** Samme toleranse som SHELF_TOLERANCE i MapCanvas.tsx. */
const SHELF_TOLERANCE = 2.5

/** En full oppbygging av kartet, slik `MapCanvas` gjør det ved montering. */
function build(spec, data, { probeAspect }) {
  if (probeAspect) {
    const probe = fromSpec(spec).fitExtent(
      [
        [0, 0],
        [1000, 1000],
      ],
      data,
    )
    geoPath(probe).bounds(data)
  }
  const projection = fromSpec(spec).fitExtent(
    [
      [12, 12],
      [1188, H - 12],
    ],
    data,
  )
  const path = geoPath(projection)
  let chars = 0
  for (const f of data.features) chars += (path(f.geometry) ?? '').length
  chars += (path({
    type: 'GeometryCollection',
    geometries: data.features.map((f) => f.geometry),
  }) ?? '').length
  if (spec.kind !== 'albersUsa') {
    const [[lon0, lat0], [lon1, lat1]] = geoBounds(data)
    chars += (path(
      geoGraticule()
        .step([10, 10])
        .extent([
          [Math.max(-180, lon0 - 10), Math.max(-85, lat0 - 10)],
          [Math.min(180, lon1 + 10), Math.min(85, lat1 + 10)],
        ])(),
    ) ?? '').length
  }
  return chars
}

function time(fn) {
  fn()
  const t0 = performance.now()
  for (let i = 0; i < RUNS; i++) fn()
  return (performance.now() - t0) / RUNS
}

/**
 * Nodetall og arbeid per zoom-ramme.
 *
 * Før: hele treet lå inline i `MapCanvas`, og transformen var React-state.
 * Hver zoom-hendelse — en per musbevegelse — bygde derfor alle elementene på nytt.
 * Etter: transformen blir skrevet rett på gruppa én gang per bilderamme, og
 * lagene under er memoisert med stabile props.
 */
function model(featureCount) {
  // sokkel ×2, landfyll, kystlinje, gradnett
  const baseBefore = 5
  // sokkel, landfyll + kystlinje i samme passering, gradnett
  const baseAfter = 3
  return {
    before: {
      nodes: baseBefore + featureCount * 2,
      perZoom: baseBefore + featureCount * 2,
      landRaster: 4,
    },
    after: { nodes: baseAfter + featureCount + 1, perZoom: 1, landRaster: 2 },
  }
}

/**
 * Sokkelstripa: punktene den må gå gjennom før og etter at den fikk sin egen,
 * grovere kopi av landmassen.
 */
function shelf(spec, data) {
  const projection = fromSpec(spec).fitExtent(
    [
      [12, 12],
      [1188, H - 12],
    ],
    data,
  )
  const geometry = {
    type: 'GeometryCollection',
    geometries: data.features.map((f) => f.geometry),
  }
  return {
    before: pathPoints(geoPath(projection)(geometry) ?? ''),
    after: pathPoints(geoPath(coarsen(projection, SHELF_TOLERANCE))(geometry) ?? ''),
  }
}

const rows = []
for (const c of CASES) {
  const data = JSON.parse(readFileSync(resolve(root, c.file), 'utf8'))
  const points = data.features.reduce((n, f) => n + countPoints(f.geometry), 0)
  const withProbe = time(() => build(c.projection, data, { probeAspect: true }))
  const cached = time(() => build(c.projection, data, { probeAspect: false }))
  rows.push({
    ...c,
    features: data.features.length,
    points,
    withProbe,
    cached,
    shelf: shelf(c.projection, data),
    ...model(data.features.length),
  })
}

const pad = (v, n) => String(v).padStart(n)
console.log('region      features   punkt   montering ms      SVG-noder    element per zoom-ramme   land-raster/ramme   sokkelpunkt')
for (const r of rows) {
  console.log(
    `${r.region.padEnd(10)} ${pad(r.features, 8)} ${pad(r.points, 7)}   ` +
      `${pad(r.withProbe.toFixed(1), 5)} → ${r.cached.toFixed(1).padEnd(5)}` +
      `  ${pad(r.before.nodes, 5)} → ${String(r.after.nodes).padEnd(5)}` +
      `      ${pad(r.before.perZoom, 5)} → ${String(r.after.perZoom).padEnd(5)}` +
      `          ${r.before.landRaster} → ${r.after.landRaster}` +
      `        ${pad(r.shelf.before, 6)} → ${r.shelf.after}`,
  )
}
console.log(
  '\nmontering: venstre = med aspekt-proben, høyre = når proben er husket (andre gang samme region blir åpnet)',
)

/*
 * Hva spillet gjør mens ingen rører noe.
 *
 * Klokka tikker ti ganger i sekundet. Før lå den i `GameScreen`, så hvert
 * tikk bygde hele spillgreina på nytt: toppbjelken med alle tallene sine, og
 * props-objektene til HUD og kart. Nå eier `QuestionClock` tilstanden selv, og
 * bare tidsstripa blir bygd på nytt.
 */
const TICKS_PER_SECOND = 10
// Games egen JSX + hele GameTopBar-treet, talt i elementnoder
const BEFORE_PER_TICK = 45
// QuestionClock + TimerBar
const AFTER_PER_TICK = 4
console.log(
  `\nhvilende spill: ${TICKS_PER_SECOND * BEFORE_PER_TICK} → ` +
    `${TICKS_PER_SECOND * AFTER_PER_TICK} React-element per sekund ` +
    `(klokka tikker ${TICKS_PER_SECOND} ganger i sekundet uansett)`,
)
