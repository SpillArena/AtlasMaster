# AtlasMaster

Kartspelet om geografi — éin region om gongen. Klikk, vel eller skriv namnet
på staden som er markert, jag combo og slå din eigen rekord.

Bygd for [Spillarena](https://spillarena.no). Ligg på
**https://spillarena.no/atlasmaster/**.

Spelet heitte NorgesMester og dekte berre Noreg fram til august 2026.

## Regionar

| Region | Kategoriar | Projeksjon |
| --- | --- | --- |
| Noreg | Fylker (15), storbyar, elvar, fjelltoppar | Conic conformal, 60/70°, rotert −15° |
| Europa | Land (39), hovudstader, elvar, toppar | Conic conformal, 35/65°, rotert −10° (ETRS89-LCC) |
| Asia | Land (44), hovudstader, elvar, toppar | Azimuthal equal area, sentrert 87°Ø/22°N |
| USA | Delstatar (50), storbyar, elvar, toppar | Albers USA (Alaska og Hawaii i innfelte ruter) |

Russland er ikkje med i nokon region. Geometrien strekk seg frå 20°Ø til over
datolinja, og `fitExtent` ville zooma ut til heile den nordlege halvkula for å
få henne med — sjå kommentaren øvst i `scripts/build-asia.mjs`.

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

Kategori-id-ar må vere unike på tvers av **alle** regionar, ikkje berre
innanfor sin eigen: flis-teksten blir slått opp som `tile.<id>`. Difor er Asia
og USA sine prefiksa (`asiaCountries`, `usStates`, …), medan Europa fekk dei
korte namna først. Noreg sine er norske og uendra (`fylker`, `storbyer`,
`elver`, `fjell`) fordi dei ligg lagra på kvar rad i leiartavla frå før
regionane fanst.

## Utvikling

```bash
npm install
npm run dev            # http://localhost:5173/atlasmaster/
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
npm run data:asia      # land, hovudstader, elvar og toppar i Asia
npm run data:usa       # delstatar, byar, elvar og toppar i USA
npm run check:geo      # utsnitt, ringretning og merkedekning
npm run check:engine   # spelreglane, køyrde direkte mot reduseraren
npm run check:sql      # verifiserer migrasjonar + spørjingar mot SQLite
npm run bench:map      # kva kartlaget kostar per region
```

Datascripta krev
`npm i --no-save world-atlas@2 us-atlas@3 topojson-client@3 topojson-server@3 topojson-simplify@3`.
`data:asia` og `data:usa` hentar i tillegg Natural Earth-datasett over nettet
første gongen, og cachar dei i `node_modules/.cache/atlasmaster/`.
Resultatet er sjekka inn, så scripta treng berre køyrast når stadlistene eller
oppløysinga skal endrast.

**Rekkjefølgja er ikkje valfri.** Byggjarane skriv rådata; dei to stega etter
gjer dei spelbare, og begge er eingongsoperasjonar som ikkje toler å køyrast
to gonger på same fila:

```bash
node scripts/build-europe-countries.mjs   # eller kva som er endra
node scripts/optimise-geo.mjs             # kuttar koordinatpresisjonen
node scripts/simplify-geo.mjs             # forenklar topologisk
npm run check:geo                         # og så sjekk at det heldt
```

Geometrien kjem utanfrå; namna gjer han ikkje. Kvar byggjar held si eiga liste
over norske og engelske namn, og hentar berre koordinatar frå kjeldene.

## Migrasjonar

```bash
npx wrangler d1 migrations apply atlasmaster-leaderboard --remote
```

`0002_add_region.sql` legg til `region` med `DEFAULT 'norway'`, så alle rader
frå før regionane blir liggande att som norske runder.

`0003_add_scoring_version.sql` legg til `scoring_version` med `DEFAULT 1`.
Modusane er ikkje like mykje verdt lenger — sjå `MODE_MULTIPLIER` i
`src/game/scoring.ts` — så eldre skriverunder ligg systematisk lågare enn nye
innanfor same modus. Ingen rad blir rørt eller rekna om; kolonna er der for at
dei skal kunne skiljast. Tavla filtrerer dessutan på modus, så ei skriverunde
og ei klikkerunde aldri blir rangerte mot kvarandre.

> Databasen heiter `atlasmaster-leaderboard`. D1 kan ikkje døypast om, så
> omdøypinga frå `norgesmester-leaderboard` vart gjord som ny database pluss
> kopiering av dei 19 radene. `database_id` er det som faktisk bind appen til
> dataene. Sjå kommentaren i `wrangler.toml`.
