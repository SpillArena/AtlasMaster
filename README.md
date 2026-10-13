<p align="center">
  <img src="public/logo.svg" width="88" alt="AtlasMaster logo" />
</p>

<h1 align="center">AtlasMaster</h1>

<p align="center"><strong>Learn the world, one region at a time.</strong><br />
A map quiz where you click, choose or type the place that lights up, chase combos and beat your own record.</p>

<p align="center">
  <a href="https://spillarena.no/atlasmaster/">Play now</a> ·
  <a href="https://spillarena.no">SpillArena</a> ·
  <a href="docs/REFERENCE.md">Developer reference</a> ·
  <a href="docs/SITE_SHELL.md">Site shell</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/Cloudflare-Pages%20%2B%20D1-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Pages and D1" />
  <img src="https://img.shields.io/badge/Languages-NO%20%2F%20EN-785A85" alt="Norwegian and English" />
</p>

## Pick a region, find the place

AtlasMaster started as a Norway-only county quiz and now covers the whole globe. Choose a region and a category, then answer by clicking the map, picking from choices or typing the name. Fast, accurate rounds build combos and a pace bonus.

- **Ten regions.** Norway, Europe, Asia, Africa, South America, North America, Oceania, Antarctica, the USA and the World.
- **Many categories.** Countries, counties, states, capitals, cities, rivers, peaks, flags, oceans and seas, and Antarctic research stations.
- **Three ways to answer.** Click the map, choose from options or type the name. Each mode has its own scoring and leaderboard.
- **Proper maps.** Each region uses a projection that suits it, such as Albers USA with Alaska and Hawaii in insets or ETRS89-LCC for Europe.
- **Leaderboards.** Sign in with a SpillArena account to post scores. Rounds are always saved on the device too, so a round is never lost to a network error.
- **Norwegian and English**, light and dark themes, and shared storage controls.

## Regions

| Region | Categories | Projection |
| --- | --- | --- |
| Norway | Counties (15), cities, rivers, peaks | Conic conformal, 60/70° |
| Europe | Countries (39), capitals, rivers, peaks | ETRS89-LCC |
| Asia | Countries (44), capitals, rivers, peaks | Azimuthal equal area |
| Africa | Countries (54), capitals, rivers, peaks, flags | Azimuthal equal area |
| South America | Countries (12), capitals, rivers, peaks, flags | Azimuthal equal area |
| North America | Countries (23), capitals, rivers, peaks, flags | Azimuthal equal area |
| Oceania | Countries (14), capitals, rivers, peaks, flags | Azimuthal equal area |
| Antarctica | Research stations (8), peaks (6) | Azimuthal equal area |
| USA | States (50), cities, rivers, peaks | Albers USA |
| World | Countries (195), flags, oceans and seas (17) | Natural Earth 1 |

Projection details, dataset pipelines and how to add a region are in the [developer reference](docs/REFERENCE.md).

## Run locally

Use Node.js 22.12+ and npm.

```bash
npm install
npm run dev     # http://localhost:5173/atlasmaster/
```

The leaderboard and accounts are Cloudflare Pages Functions backed by D1. To test them, run `npx wrangler pages dev` next to the app and put `AUTH_SECRET=<long random string>` in an ignored `.dev.vars`. Without it, the game still plays and keeps results on the device.

## Check a change

```bash
npm run lint
npm run check:regions   # loaders, projections, translations, score validation
npm run check:geo       # extent, ring winding, emblem coverage
npm run check:engine    # game rules against the reducer
npm run check:sql       # migrations and queries against SQLite
npm run build
```

## Built with

React · TypeScript · Vite · Tailwind CSS · Framer Motion · i18next · Cloudflare Pages Functions · D1

```text
src/          Game engine, map canvas, regions, translations and UI
functions/    Leaderboard and account API routes
scripts/      Dataset builders and checks
docs/         Developer reference and shared site shell notes
```

Geometry comes from [Natural Earth](https://www.naturalearthdata.com/), world-atlas and us-atlas. Norway's county borders are Kartverket data via [robhop/fylker-og-kommuner](https://github.com/robhop/fylker-og-kommuner) (CC BY 4.0).

## Contributing

Create a branch from `development`, keep changes focused and run the checks above. Dataset changes need the rebuild steps in the [reference](docs/REFERENCE.md#datasets-and-checks).

---

Part of [SpillArena](https://spillarena.no) · Created by [Emil Berglund](https://github.com/EmilB04)
