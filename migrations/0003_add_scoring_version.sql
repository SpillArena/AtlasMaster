-- Merk hver rad med hvilke poengregler den ble regnet etter.
--
-- Modusene er ikke lenger like mye verdt. Å skrive navnet er den
-- vanskeligste av de tre, og gir fra nå av 50 % mer enn å klikke, mens
-- flervalg gir 20 % mindre — se MODE_MULTIPLIER i src/game/scoring.ts.
--
-- Det gjør eldre resultat usammenlignbare med nye INNENFOR SAMME MODUS: en
-- gammel skrive-runde er regnet etter ×1 og en ny etter ×1,5, så den gamle
-- ligger systematisk for lavt. Radene er ikke ødelagt — de er bare regnet
-- etter andre regler, og nå sier de selv hvilke regler det var.
--
-- Alt som fantes før denne migrasjonen er versjon 1. DEFAULT 1 fyller dem inn;
-- nye rader får versjonen fra SCORING_VERSION i Pages-funksjonen.
ALTER TABLE leaderboard_entries ADD COLUMN scoring_version INTEGER NOT NULL DEFAULT 1;

-- Tavla blir nå lest per modus i tillegg til region og kategori: en
-- skriverunde og en klikkerunde er to ulike øvelser og skal ikke rangeres
-- mot hverandre.
CREATE INDEX IF NOT EXISTS idx_leaderboard_region_category_mode_score
    ON leaderboard_entries (region, category, mode, score DESC, timestamp DESC);
