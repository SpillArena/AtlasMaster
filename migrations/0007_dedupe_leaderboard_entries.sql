-- Fjern duplikatrader på tavla: samme spiller, samme øvelse.
--
-- ØVELSEN er (username, region, category, mode, pace) — akkurat gruppen
-- fetchTop() i functions/api/leaderboard/index.js allerede rangerer og
-- viser bare den beste raden fra. Historiske innsendinger (før noe hindret
-- flere runder i samme øvelse fra å legge seg ved siden av
-- hverandre) ligger fortsatt i tabellen som støy: de vises aldri, men tar
-- plass og gjør `SELECT *` misvisende for alt som ikke går via fetchTop().
--
-- Rangeringen speiler ROW_NUMBER()-vinduet i fetchTop(): høyest score
-- vinner, likt score avgjøres av nyeste tidsstempel, likt tidsstempel av
-- høyest id. Alt som ikke er rangert først i sin gruppe, slettes.
DELETE FROM leaderboard_entries
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY username, region, category, mode, pace
             ORDER BY score DESC, timestamp DESC, id DESC
           ) AS rank_in_group
    FROM leaderboard_entries
  )
  WHERE rank_in_group > 1
);
