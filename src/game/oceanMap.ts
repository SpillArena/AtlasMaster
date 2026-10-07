import type { ProjectionSpec } from './types'

// Keep Europe in the middle of the world map, with room to tap polar waters.
export const OCEAN_PROJECTION: ProjectionSpec = { kind: 'equirectangular', centre: 15 }

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
