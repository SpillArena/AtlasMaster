# AtlasMaster

The map game about geography, one region at a time. Click, choose or type the
name of the place that lights up, chase combos and beat your own record.

Built for [Spillarena](https://spillarena.no). Lives at
**https://spillarena.no/atlasmaster/**.

The game was called NorgesMester and covered only Norway until August 2026.

## Regions

| Region | Categories | Projection |
| --- | --- | --- |
| Norway | Counties (15), cities, rivers, peaks | Conic conformal, 60/70°, rotated −15° |
| Europe | Countries (39), capitals, rivers, peaks | Conic conformal, 35/65°, rotated −10° (ETRS89-LCC) |
| Asia | Countries (44), capitals, rivers, peaks | Azimuthal equal area, centred 87°E/22°N |
| USA | States (50), cities, rivers, peaks | Albers USA (Alaska and Hawaii in inset boxes) |

Russia is in no region. Its geometry runs from 20°E across the date line, and
`fitExtent` would zoom out to the whole northern hemisphere to include it. See
the comment at the top of `scripts/build-asia.mjs`.

### Adding a new region

Everything a region needs lives in `src/game/regions.ts`. The steps:

1. Put GeoJSON under `src/data/<region>/`. Every feature needs
   `properties.id` and `properties.name`, and optionally `properties.nameEn`.
2. Write a `Region` object in `regions.ts` with the projection, outline and
   categories.
3. Add the i18n keys `region.<id>`, `cat.<category>` and `tile.<category>` in
   `src/i18n/locales/`.
4. Add the category ids to `REGION_CATEGORIES` in
   `functions/api/leaderboard/index.js`, or the results get rejected.

No other file should need changing. The canvas, the background map and the
category previews read the projection from the region, and `naturalAspect()`
makes a wide continent and a narrow country both fill the screen.

Category ids must be unique across **all** regions, not just within their own:
the tile text is looked up as `tile.<id>`. That is why the Asia and USA ids are
prefixed (`asiaCountries`, `usStates`, …) while Europe got the short names
first. Norway's ids are Norwegian and unchanged (`fylker`, `storbyer`, `elver`,
`fjell`) because they are stored on every leaderboard row from before regions
existed.

## Development

```bash
npm install
npm run dev            # http://localhost:5173/atlasmaster/
npm run build
npm run lint
```

The leaderboard is a Cloudflare Pages Function backed by D1. Run it alongside
the app to test cloud storage locally:

```bash
npx wrangler pages dev
```

If the board does not respond, the game falls back to the results stored on the
device. A round is never lost because the cloud was unreachable.

### Datasets and checks

```bash
npm run data:europe    # rebuild the Europe outline from Natural Earth
npm run data:asia      # countries, capitals, rivers and peaks in Asia
npm run data:usa       # states, cities, rivers and peaks in the USA
npm run check:geo      # extent, ring winding and emblem coverage
npm run check:engine   # the game rules, run directly against the reducer
npm run check:sql      # verifies migrations + queries against SQLite
npm run bench:map      # what the map layer costs per region
```

The data scripts need
`npm i --no-save world-atlas@2 us-atlas@3 topojson-client@3 topojson-server@3 topojson-simplify@3`.
`data:asia` and `data:usa` also fetch Natural Earth datasets over the network
the first time and cache them in `node_modules/.cache/atlasmaster/`. The result
is checked in, so the scripts only need to run when the place lists or the
resolution change.

**The order is not optional.** The builders write raw data; the two steps after
make it playable, and both are one-time operations that cannot run twice on the
same file:

```bash
node scripts/build-europe-countries.mjs   # or whatever changed
node scripts/optimise-geo.mjs             # cuts coordinate precision
node scripts/simplify-geo.mjs             # simplifies topologically
npm run check:geo                         # then check that it held
```

The geometry comes from outside; the names do not. Each builder keeps its own
list of Norwegian and English names and takes only coordinates from the
sources.

## Migrations

```bash
npx wrangler d1 migrations apply atlasmaster-leaderboard --remote
```

`0002_add_region.sql` adds `region` with `DEFAULT 'norway'`, so every row from
before regions stays as a Norway round.

`0003_add_scoring_version.sql` adds `scoring_version` with `DEFAULT 1`. The
modes are not worth the same any more (see `MODE_MULTIPLIER` in
`src/game/scoring.ts`), so older typing rounds sit systematically lower than new
ones within the same mode. No row is touched or recomputed; the column is there
so they can be told apart. The board also filters by mode, so a typing round and
a clicking round are never ranked against each other.

> The database is called `atlasmaster-leaderboard`. D1 cannot be renamed, so the
> rename from `norgesmester-leaderboard` was done as a new database plus copying
> the 19 rows across. `database_id` is what actually binds the app to the data.
> See the comment in `wrangler.toml`.
