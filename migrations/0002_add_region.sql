-- Legg til region på ledertavla.
--
-- Alle rader som fantes før denne migrasjonen er norske runder — spillet
-- hadde ingen andre regioner. DEFAULT 'norway' fyller dem derfor inn
-- automatisk, og NOT NULL holder nye rader ærlige.
ALTER TABLE leaderboard_entries ADD COLUMN region TEXT NOT NULL DEFAULT 'norway';

-- Tavla blir alltid lest per region: enten hele regionen, eller region +
-- kategori. Den gamle kategori-indeksen dekker ikke noe av det lenger.
CREATE INDEX IF NOT EXISTS idx_leaderboard_region_score
    ON leaderboard_entries (region, score DESC, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_region_category_score
    ON leaderboard_entries (region, category, score DESC, timestamp DESC);
