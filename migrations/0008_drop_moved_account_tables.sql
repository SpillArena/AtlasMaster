-- Kontoene bor ikke her lenger.
--
-- `players` (0005) og `player_progress` (0006) ble laget da AtlasMaster var det
-- eneste spillet med kontoer. Nå er kontoen felles for hele domenet: radene er
-- kopiert til `spillarena-accounts` med samme PIN-hash og samme salt — se
-- SpillArena/scripts/migrate-atlasmaster-accounts.mjs — og det er DEN databasen
-- som svarer på hvem en spiller er. Endepunktene som leste disse tabellene
-- (functions/api/auth/, functions/api/profile/) finnes ikke i dette prosjektet
-- lenger.
--
-- To kopier av de samme kontoene er verre enn én. Den som ikke er i bruk blir
-- ikke oppdatert, og neste gang noen ser på den, ser den ut som data.
--
-- FØR DENNE KJØRES ble hver eneste rad sammenlignet felt for felt mot
-- `spillarena-accounts`: tre kontoer, to profiler, alle identiske. Tavla
-- (`leaderboard_entries`) rører vi ikke — den er AtlasMaster sin egen og blir
-- liggende.
DROP TABLE IF EXISTS player_progress;
DROP TABLE IF EXISTS players;
