import { geoConicConformal, geoPath } from 'd3-geo'
import type { GeoPath, GeoProjection } from 'd3-geo'
import type { FeatureCollection } from 'geojson'

/**
 * Conic conformal-projeksjon sentrert på Norge. Standardparalleller 60/70°
 * og rotasjon -15° lengde gir riktig form på det nord-strukne landet.
 * fitExtent skalerer + sentrerer hele datasettet inn i [width, height].
 */
export function makeProjection(
  data: FeatureCollection,
  width: number,
  height: number,
  padding = 12,
): GeoProjection {
  return geoConicConformal()
    .parallels([60, 70])
    .rotate([-15, 0])
    .fitExtent(
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
