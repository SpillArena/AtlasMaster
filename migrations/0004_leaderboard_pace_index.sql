-- Tempoet blei ein del av øvinga.
--
-- Spørjinga grupperer no på (username, region, category, mode, pace) og
-- sorterer på score. Ingen av dei eksisterande indeksane leier med username,
-- så kvar einaste lesing var full skanning pluss sortering. Det gjekk fint på
-- nitten rader; det er ikkje ein plan.
CREATE INDEX IF NOT EXISTS idx_leaderboard_group_best
  ON leaderboard_entries (username, region, category, mode, pace, score DESC);

-- Filtera tavla faktisk brukar, i den rekkjefølgja dei blir sette.
CREATE INDEX IF NOT EXISTS idx_leaderboard_region_category_mode_pace
  ON leaderboard_entries (region, category, mode, pace, score DESC, timestamp DESC);

-- 0002 sa i kommentaren sin at denne var avløyst av
-- idx_leaderboard_region_category_score, men fjerna henne aldri. Ein indeks
-- ingen spørjing kan bruke kostar skriving og plass, og ingenting anna.
DROP INDEX IF EXISTS idx_leaderboard_category_score;
