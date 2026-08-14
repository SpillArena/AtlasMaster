import {
  geoAlbersUsa,
  geoAzimuthalEqualArea,
  geoConicConformal,
  geoNaturalEarth1,
  geoPath,
} from 'd3-geo'
import type { GeoPath, GeoProjection } from 'd3-geo'
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
