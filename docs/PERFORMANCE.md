# Performance pass — 2026-11-04

Measured a production build in headless Chromium with 4× CPU throttling at
1365 × 900. The same script loaded the landing page, moved the pointer over
regions, opened Norway → Counties, visited the mode and pace menus, started
a normal click round as a guest, and zoomed and dragged the map.

These are local trace comparisons, not frame-rate guarantees for every device.
Raster time sums work across raster threads and can exceed elapsed wall time.
The idle samples last three seconds; the drag repeats the same wheel event and
30 pointer moves. Startup includes dismissing the consent dialog and a fixed
two-second wait, so its wall-clock duration is not a loading-time metric.

| Measurement | Before | After | Change |
| --- | ---: | ---: | ---: |
| Landing app JavaScript, excluding geographic data, decoded bytes | 862,320 | 600,673 | −30% |
| All initial JavaScript, including geographic data, decoded bytes | 1,828,955 | 1,329,387 | −27% |
| Startup raster work | 10,715 ms | 3,260 ms | −70% |
| Zoom-and-drag raster work | 5,408 ms | 918 ms | −83% |
| Mode menu animation-frame callback work, idle | 199 ms | 3 ms | −98% |

The JavaScript sizes include shared chunks, not just the entry bundle.

## Changes

- Map gestures update a promoted SVG group's CSS transform once per frame.
  This allows compositing during drags instead of invalidating vector geometry
  on every movement. D3 still owns the zoom state and coordinate conversion.
- Map setup reuses projected path strings across scenery and answer layers.
  Serialized paths use one decimal place; bounds and hit-target placement use
  the original geographic geometry.
- Background scenery is static and omitted behind the landing map and during
  gameplay. Full-screen moving blur layers and coastline drawing animations
  are removed. HUD/menu panels are opaque paper, avoiding backdrop blur.
- Mode demos use paused CSS transform/opacity animations. They run when the
  row is hovered or keyboard-focused, and stop with reduced motion enabled.
- Category previews load when near the viewport, retain projected paths for
  return visits, and use coarse scenery paths without a blur filter.
- Gameplay, menu steps, the full leaderboard, and the profile panel load on
  demand. The landing page does not download the quiz and world flag renderer.
- Result confetti plays once and fades out, instead of looping indefinitely.
  It also respects the system reduced-motion preference.
- The landing compass is memoized so region hover updates do not rebuild it.

## Verification

Run `npm run build`, `npm run lint`, `npm run check:engine`,
`npm run check:geo`, and `npm run check:regions`. The registry checks load and
project all 41 categories and exercise every supported answer mode, bilingual
answers, ocean locations, and water/land layer ordering.

Browser checks cover desktop/mobile menus, polygon/point/line maps, flag modes,
oceans, answering, skipping, zoom/reset, and leaving rounds.

Large geography chunks remain intentionally lazy-loaded. Loading the detailed
world map still costs more than a small regional map; it is no longer part of
the landing page's app bundle.
