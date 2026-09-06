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
 * Hver region velger sin egen projeksjon. Et land som strekker seg nord-sør
 * (Norge) og et kontinent som strekker seg øst-vest (Europa) tåler ikke
 * samme kartprojeksjon uten at det ene blir vridd ut av form.
 *
 * `fitExtent` gjør resten: den skalerer og sentrerer datasettet inn i
 * [width, height], så ingen region trenger hardkodet senter eller zoom.
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
 * Samme projeksjon, men med punktene tynnet ut *etter* at de er projisert.
 *
 * Kystlinja til Norge er nesten ti tusen punkt. Å fylle den flata er billig —
 * nettleseren rasteriserer et polygon én gang. Å *streke* den er det
 * ikke: en strek med bredde og runde hjørner må bygges som en ny figur med
 * to sider og et ledd per punkt, og sokkelstripa rundt kysten er den bredeste
 * streken på kartet. Den blir bygd på nytt for hver bilderamme mens fingeren
 * drar.
 *
 * En ni enheter bred, myk stripe trenger ikke fjordene. Vi lar derfor stripa
 * gå på en grovere kopi av samme geometrien: fyllingen og kystlinja står
 * fortsatt i full oppløsning, så ingenting synlig endrer seg — det er bare
 * det brede laget under som slutter å telle hver skjærgårdsholme.
 *
 * Toleransen er i lerretsenheter (lerretet er 900 høyt). Første punktet i
 * hver ring blir alltid med, så en ring kan aldri forsvinne helt; små øyer
 * kan derimot krympe til et punkt og falle ut av stripa. Det er meningen —
 * de har landflata si i full oppløsning rett oppå.
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
 * Bredde delt på høyde for regionen slik den faktisk blir projisert.
 *
 * Norge er høyt og smalt, Europa er bredt og lavt. Et fast lerret ville
 * gitt den ene regionen svarte marger på begge sider og den andre et
 * frimerke midt på skjermen. Vi projiserer derfor inn i et kvadrat, måler
 * hvor mye plass forma faktisk tok, og lar lerretet følge det.
 */
/**
 * Målingen går gjennom hele datasettet to ganger — én gang for `fitExtent`
 * og én for `bounds` — og et kontinent er titusenvis av punkt. Svaret er
 * likevel det samme hver gang for et gitt datasett og en gitt projeksjon, så
 * det blir husket. En `WeakMap` holder ikke datasettet i live: dropper spillet
 * regionen, forsvinner målingen med den.
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
