/**
 * Måleband for kartlaget.
 *
 *   node scripts/bench-map.mjs
 *
 * Skriv ut, per region:
 *   - kor mange features og koordinatpunkt datasettet inneheld
 *   - kor lang tid det tek å byggje kartet éin gong (projeksjon + baner)
 *   - kor mange SVG-nodar kartet legg i DOM-en
 *   - kor mange React-element som blir bygde på nytt per zoom-ramme
 *   - kor mange gonger landmassen blir rasterisert per ramme
 *
 * Dei tre siste tala er dei som avgjer om kartet held 60 fps: alt React lagar
 * på nytt medan fingeren dreg, må òg samanliknast og potensielt teiknast om.
 *
 * MERK — skriptet speglar rendermodellen i `MapCanvas.tsx`. Endrar du
 * lagdelinga der, må tabellane under følgje etter, elles måler du eit kart
 * som ikkje finst.
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
    region: 'Noreg',
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

/** Ei full oppbygging av kartet, slik `MapCanvas` gjer det ved montering. */
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
 * Nodetal og arbeid per zoom-ramme.
 *
 * Før: heile treet låg inline i `MapCanvas`, og transformen var React-state.
 * Kvar zoom-hending — ei per musrørsle — bygde difor alle elementa på nytt.
 * Etter: transformen blir skriven rett på gruppa éin gong per biletramme, og
 * laga under er memoiserte med stabile props.
 */
function model(featureCount) {
  // sokkel ×2, landfyll, kystlinje, gradnett
  const baseBefore = 5
  // sokkel, landfyll + kystlinje i same passering, gradnett
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

const rows = []
for (const c of CASES) {
  const data = JSON.parse(readFileSync(resolve(root, c.file), 'utf8'))
  const points = data.features.reduce((n, f) => n + countPoints(f.geometry), 0)
  const withProbe = time(() => build(c.projection, data, { probeAspect: true }))
  const cached = time(() => build(c.projection, data, { probeAspect: false }))
  rows.push({ ...c, features: data.features.length, points, withProbe, cached, ...model(data.features.length) })
}

const pad = (v, n) => String(v).padStart(n)
console.log('region      features   punkt   montering ms      SVG-nodar    element per zoom-ramme   land-raster/ramme')
for (const r of rows) {
  console.log(
    `${r.region.padEnd(10)} ${pad(r.features, 8)} ${pad(r.points, 7)}   ` +
      `${pad(r.withProbe.toFixed(1), 5)} → ${r.cached.toFixed(1).padEnd(5)}` +
      `  ${pad(r.before.nodes, 5)} → ${String(r.after.nodes).padEnd(5)}` +
      `      ${pad(r.before.perZoom, 5)} → ${String(r.after.perZoom).padEnd(5)}` +
      `          ${r.before.landRaster} → ${r.after.landRaster}`,
  )
}
console.log(
  '\nmontering: venstre = med aspekt-proben, høgre = når proben er hugsa (andre gong same region blir opna)',
)
