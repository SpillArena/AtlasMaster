import {
  geoAlbersUsa,
  geoAzimuthalEqualArea,
  geoConicConformal,
  geoNaturalEarth1,
  geoPath,
} from 'd3-geo'
import type { GeoPath, GeoProjection, GeoStream, GeoStreamWrapper } from 'd3-geo'
import type { FeatureCollection } from 'geojson'
import type { ProjectionSpec } from './types'

/**
 * Kvar region vel si eiga projeksjon. Eit land som strekk seg nord-sør
 * (Noreg) og eit kontinent som strekk seg aust-vest (Europa) toler ikkje
 * same kartprojeksjon utan at det eine blir vridd ut av form.
 *
 * `fitExtent` gjer resten: den skalerer og sentrerer datasettet inn i
 * [width, height], så ingen region treng hardkoda senter eller zoom.
 */
function fromSpec(spec: ProjectionSpec): GeoProjection {
  switch (spec.kind) {
    case 'conicConformal':
      return geoConicConformal().parallels(spec.parallels).rotate([spec.rotate, 0])
    case 'azimuthalEqualArea':
      return geoAzimuthalEqualArea().rotate([-spec.centre[0], -spec.centre[1]])
    // albersUsa har hverken senter eller rotasjon å sette — de tre rutene
    // ligger fast i projeksjonen. `fitExtent` skalerer dem som én figur.
    case 'albersUsa':
      return geoAlbersUsa()
    case 'naturalEarth':
      return geoNaturalEarth1()
  }
}

export function makeProjection(
  spec: ProjectionSpec,
  data: FeatureCollection,
  width: number,
  height: number,
  padding = 12,
): GeoProjection {
  return fromSpec(spec).fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    data,
  )
}

export function makePath(projection: GeoProjection): GeoPath {
  return geoPath(projection)
}

/**
 * Same projeksjon, men med punkta tynna ut *etter* at dei er projiserte.
 *
 * Kystlinja til Noreg er nesten ti tusen punkt. Å fylle den flata er billeg —
 * nettlesaren rasteriserer eit polygon éin gong. Å *streke* henne er det
 * ikkje: ei strek med breidd og runde hjørne må byggjast som ein ny figur med
 * to sider og eit ledd per punkt, og sokkelstripa rundt kysten er den breiaste
 * streken på kartet. Ho blir bygd på nytt for kvar biletramme medan fingeren
 * dreg.
 *
 * Ei ni einingar brei, mjuk stripe treng ikkje fjordane. Vi lèt difor stripa
 * gå på ein grovare kopi av same geometrien: fyllinga og kystlinja står
 * framleis i full oppløysing, så ingenting synleg endrar seg — det er berre
 * det brede laget under som sluttar å telje kvar skjærgardsholme.
 *
 * Toleransen er i lerretseiningar (lerretet er 900 høgt). Første punktet i
 * kvar ring blir alltid med, så ein ring kan aldri forsvinne heilt; små øyar
 * kan derimot krympe til eit punkt og falle ut av stripa. Det er meininga —
 * dei har landflata si i full oppløysing rett oppå.
 */
function coarsen(projection: GeoProjection, tolerance: number): GeoStreamWrapper {
  return {
    stream(sink: GeoStream): GeoStream {
      let lastX = 0
      let lastY = 0
      let atStart = true

      const thinned: GeoStream = {
        point(x: number, y: number, z?: number) {
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
        lineEnd() {
          sink.lineEnd()
        },
        polygonStart() {
          sink.polygonStart()
        },
        polygonEnd() {
          sink.polygonEnd()
        },
        sphere() {
          sink.sphere?.()
        },
      }

      return projection.stream(thinned)
    },
  }
}

/** Baneteiknar for den grove kopien — sjå `coarsen`. */
export function makeCoarsePath(projection: GeoProjection, tolerance: number): GeoPath {
  return geoPath(coarsen(projection, tolerance))
}

/**
 * Breidde delt på høgd for regionen slik den faktisk blir projisert.
 *
 * Noreg er høgt og smalt, Europa er breitt og lågt. Eit fast lerret ville
 * gjeve den eine regionen svarte marger på begge sider og den andre eit
 * frimerke midt på skjermen. Vi projiserer difor inn i eit kvadrat, måler
 * kva plass forma faktisk tok, og let lerretet følgje det.
 */
/**
 * Målinga går gjennom heile datasettet to gonger — éin gong for `fitExtent`
 * og éin for `bounds` — og eit kontinent er titusenvis av punkt. Svaret er
 * likevel det same kvar gong for eit gitt datasett og ei gitt projeksjon, så
 * det blir hugsa. Ein `WeakMap` held ikkje datasettet i live: droppar spelet
 * regionen, forsvinn målinga med han.
 */
const aspectCache = new WeakMap<FeatureCollection, Map<string, number>>()

export function naturalAspect(spec: ProjectionSpec, data: FeatureCollection): number {
  const key = JSON.stringify(spec)
  let perSpec = aspectCache.get(data)
  if (!perSpec) {
    perSpec = new Map()
    aspectCache.set(data, perSpec)
  }
  const cached = perSpec.get(key)
  if (cached !== undefined) return cached

  const probe = fromSpec(spec).fitExtent(
    [
      [0, 0],
      [1000, 1000],
    ],
    data,
  )
  const [[x0, y0], [x1, y1]] = geoPath(probe).bounds(data)
  const width = x1 - x0
  const height = y1 - y0
  const aspect = width > 0 && height > 0 ? width / height : 1
  perSpec.set(key, aspect)
  return aspect
}
