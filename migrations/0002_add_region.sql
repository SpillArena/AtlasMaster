-- Legg til region på leiartavla.
--
-- Alle rader som fanst før denne migrasjonen er norske runder — spelet
-- hadde ingen andre regionar. DEFAULT 'norway' fyller dei difor inn
-- automatisk, og NOT NULL held nye rader ærlege.
ALTER TABLE leaderboard_entries ADD COLUMN region TEXT NOT NULL DEFAULT 'norway';

-- Tavla blir alltid lest per region: anten heile regionen, eller region +
-- kategori. Den gamle kategori-indeksen dekkjer ikkje noko av det lenger.
CREATE INDEX IF NOT EXISTS idx_leaderboard_region_score
    ON leaderboard_entries (region, score DESC, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_region_category_score
    ON leaderboard_entries (region, category, score DESC, timestamp DESC);
