import type { FeatureCollection } from 'geojson'
import type { ProjectionSpec } from './types'

// Cut the world through the Americas so the Pacific and Atlantic basins both
// stay together. A rectangular map also gives the polar waters room to tap.
export const OCEAN_PROJECTION: ProjectionSpec = { kind: 'equirectangular', centre: 110 }

function viewport(west: number, south: number, east: number, north: number): FeatureCollection {
  // Short edges keep d3's spherical interpolation close to the parallels.
  const ring: number[][] = []
  for (let lat = south; lat < north; lat += 2) ring.push([west, lat])
  for (let lon = west; lon < east; lon += 2) ring.push([lon, north])
  for (let lat = north; lat > south; lat -= 2) ring.push([east, lat])
  for (let lon = east; lon > west; lon -= 2) ring.push([lon, south])
  ring.push([west, south])
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] } }] }
}

export const OCEAN_VIEWS: { id: string; projection: ProjectionSpec; fit?: FeatureCollection }[] = [
  { id: 'world', projection: OCEAN_PROJECTION },
  { id: 'europe', projection: { kind: 'equirectangular', centre: 15 },
    fit: viewport(-15, 25, 45, 78) },
  { id: 'asia', projection: { kind: 'equirectangular', centre: 95 },
    fit: viewport(32, 0, 145, 50) },
  { id: 'americas', projection: { kind: 'equirectangular', centre: -75 },
    fit: viewport(-105, -5, -45, 40) },
  { id: 'pacific', projection: { kind: 'equirectangular', centre: 170 },
    fit: viewport(125, -35, 180, 68) },
]

// Geographic centroids of polar caps and coastal seas can fall on land.
// Place the small-target aids at known open-water locations instead.
export const OCEAN_ANCHORS: Record<string, [number, number]> = {
  pacific: [-140, 20], atlantic: [-30, 20], indian: [80, -20],
  arctic: [0, 80], southern: [40, -64],
  northSea: [3, 56], blackSea: [34, 43], mediterranean: [20, 33],
  southChinaSea: [115, 15], eastChinaSea: [125, 29], balticSea: [19, 57],
  redSea: [38, 20], caribbeanSea: [-75, 15], norwegianSea: [5, 67],
  arabianSea: [63, 15], beringSea: [175, 60], coralSea: [155, -18],
}
