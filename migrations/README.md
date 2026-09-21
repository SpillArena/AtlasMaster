# Disse migrasjonene er avløst

Ledertavla ligger ikke lenger i databasen `atlasmaster-leaderboard`. Den ligger
i `spillarena-hub`, som hele domenet deler, i tabellen `atlasmaster_leaderboard`
— se `wrangler.toml`.

**Ikke kjør `wrangler d1 migrations apply` herfra.** Det er ikke bare unødvendig,
det er farlig: `d1_migrations` er én tabell per database med UNIQUE på navnet, og
hvert spill har sin egen `0001_*.sql`. To av filene her er dessuten direkte i
strid med databasen de ville truffet:

- `0005_create_players.sql` og `0006_create_player_progress.sql` lager
  kontotabeller. Kontoene flyttet til forsiden for lenge siden, og `0008` droppet
  restene — den er allerede kjørt, så tabellene finnes ikke i
  `atlasmaster-leaderboard` i dag.
- `0006` lager `player_progress` med `PRIMARY KEY (username)`. Tabellen i
  `spillarena-hub` har `PRIMARY KEY (username, game)`, fordi én konto har én
  profil *per spill*. Kjørt mot navet ville den lagt igjen en tabell med feil
  form — og `0008` ville så droppet kontotabellen hele domenet er avhengig av.
  De to filene er harmløse der de er og farlige alle andre steder.

Sluttilstanden etter `0001` til `0004` er skrevet ut som én tabell i
`SpillArena/migrations/0002_create_atlasmaster_leaderboard.sql`. Skal tavla endre
form, skjer det der.

Filene her er beholdt en stund som historikk og som det raskeste veien tilbake
hvis flyttingen må rulles av. Når `atlasmaster-leaderboard` slettes, kan hele
denne mappa slettes med den.
