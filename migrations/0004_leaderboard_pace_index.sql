-- Tempoet ble en del av øvelsen.
--
-- Spørringen grupperer nå på (username, region, category, mode, pace) og
-- sorterer på score. Ingen av de eksisterende indeksene leder med username,
-- så hver eneste lesing var full skanning pluss sortering. Det gikk fint på
-- nitten rader; det er ikke en plan.
CREATE INDEX IF NOT EXISTS idx_leaderboard_group_best
  ON leaderboard_entries (username, region, category, mode, pace, score DESC);

-- Filtrene tavla faktisk bruker, i den rekkefølgen de blir satt.
CREATE INDEX IF NOT EXISTS idx_leaderboard_region_category_mode_pace
  ON leaderboard_entries (region, category, mode, pace, score DESC, timestamp DESC);

-- 0002 sa i kommentaren sin at denne var avløst av
-- idx_leaderboard_region_category_score, men fjernet den aldri. En indeks
-- ingen spørring kan bruke koster skriving og plass, og ingenting annet.
DROP INDEX IF EXISTS idx_leaderboard_category_score;
