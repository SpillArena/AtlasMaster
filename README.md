# Atlas Arena

Kartspelet om geografi — éin region om gongen. Klikk, vel eller skriv namnet
på staden som er markert, jag combo og slå din eigen rekord.

Bygd for [Spillarena](https://spillarena.no). Ligg på
**https://spillarena.no/atlas/**.

Spelet heitte NorgesMester og dekte berre Noreg fram til august 2026.

## Regionar

| Region | Kategoriar | Projeksjon |
| --- | --- | --- |
| Noreg | Fylker (15), storbyar, elvar, fjelltoppar | Conic conformal, 60/70°, rotert −15° |
| Europa | Land (39), hovudstader, elvar, toppar | Conic conformal, 35/65°, rotert −10° (ETRS89-LCC) |

### Legge til ein ny region

Alt ein region treng bur i `src/game/regions.ts`. Framgangsmåten:

1. Legg GeoJSON under `src/data/<region>/`. Kvar feature treng
   `properties.id` og `properties.name`, og valfritt `properties.nameEn`.
2. Skriv eit `Region`-objekt i `regions.ts` med projeksjon, omriss og
   kategoriar.
3. Legg til i18n-nøklane `region.<id>`, `cat.<kategori>` og
   `tile.<kategori>` i `src/i18n/locales/`.
4. Legg kategori-id-ane inn i `REGION_CATEGORIES` i
   `functions/api/leaderboard/index.js`, elles blir resultata avviste.

Ingen andre filer skal trenge endring. Lerret, bakgrunnskart og
kategori-previews les projeksjonen frå regionen, og
`naturalAspect()` gjer at eit breitt kontinent og eit smalt land begge fyller
skjermen.

Kategori-id-ar er unike per region med vilje. Noreg sine er norske og
uendra (`fylker`, `storbyer`, `elver`, `fjell`) fordi dei ligg lagra på kvar
rad i leiartavla frå før regionane fanst.

## Utvikling

```bash
npm install
npm run dev            # http://localhost:5173/atlas/
npm run build
npm run lint
```

Leiartavla er ein Cloudflare Pages Function med D1. Køyr han ved sida av for
å teste skylagring lokalt:

```bash
npx wrangler pages dev
```

Svarar ikkje tavla, fell spelet tilbake på resultata som ligg på eininga —
ei runde skal aldri gå tapt fordi skya ikkje svara.

### Datasett og sjekkar

```bash
npm run data:europe    # byggjer Europa-omrisset på nytt frå Natural Earth
npm run check:sql      # verifiserer migrasjonar + spørjingar mot SQLite
```

`data:europe` krev `npm i --no-save world-atlas@2 topojson-client@3`.
Resultatet er sjekka inn, så scriptet treng berre køyrast når landlista eller
oppløysinga skal endrast.

## Migrasjonar

```bash
npx wrangler d1 migrations apply norgesmester-leaderboard --remote
```

`0002_add_region.sql` legg til `region` med `DEFAULT 'norway'`, så alle rader
frå før regionane blir liggande att som norske runder.

> Pages-prosjektet og D1-databasen heiter framleis `norgesmester-*`. Det er
> med vilje — namna er Cloudflare-ressursar som ikkje kan døypast om ved å
> redigere `wrangler.toml`, og `database_id` er det som faktisk bind appen
> til dataene. Sjå kommentaren i `wrangler.toml`.
