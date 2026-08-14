-- Merk kvar rad med kva poengreglar ho blei rekna etter.
--
-- Modusane er ikkje lenger like mykje verdt. Å skrive namnet er den
-- vanskelegaste av dei tre, og gjev frå no av 50 % meir enn å klikke, medan
-- flervalg gjev 20 % mindre — sjå MODE_MULTIPLIER i src/game/scoring.ts.
--
-- Det gjer eldre resultat usamanliknbare med nye INNANFOR SAME MODUS: ei
-- gammal skrive-runde er rekna etter ×1 og ei ny etter ×1,5, så den gamle
-- ligg systematisk for lågt. Radene er ikkje øydelagde — dei er berre rekna
-- etter andre reglar, og no seier dei sjølve kva reglar det var.
--
-- Alt som fanst før denne migrasjonen er versjon 1. DEFAULT 1 fyller dei inn;
-- nye rader får versjonen frå SCORING_VERSION i Pages-funksjonen.
ALTER TABLE leaderboard_entries ADD COLUMN scoring_version INTEGER NOT NULL DEFAULT 1;

-- Tavla blir no lest per modus i tillegg til region og kategori: ein
-- skriverunde og ein klikkerunde er to ulike øvingar og skal ikkje rangerast
-- mot kvarandre.
CREATE INDEX IF NOT EXISTS idx_leaderboard_region_category_mode_score
    ON leaderboard_entries (region, category, mode, score DESC, timestamp DESC);
