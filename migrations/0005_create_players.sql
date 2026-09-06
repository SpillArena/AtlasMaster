-- Spillerkontoer: brukernavn og PIN.
--
-- Tavla identifiserte en spiller med en streng fra et tekstfelt. Hvem som
-- helst kunne sende inn et resultat under hvilket navn som helst, og siden
-- spørringen holder én rad per brukernavn, ville en høyere falsk poengsum
-- ERSTATTE raden til den virkelige spilleren, ikke legge seg ved siden av.
--
-- COLLATE NOCASE på primærnøkkelen gjør to ting på en gang. Den hindrer at
-- «Kari» og «kari» blir to kontoer, og den retter opp en feil som allerede fantes:
-- de to var to separate rader på tavla, og så ut som duplikat.
CREATE TABLE IF NOT EXISTS players (
  username    TEXT PRIMARY KEY COLLATE NOCASE,
  pin_hash    TEXT NOT NULL,
  pin_salt    TEXT NOT NULL,
  -- hvor mange ganger PIN-en er gjettet feil siden sist riktig innlogging
  failed      INTEGER NOT NULL DEFAULT 0,
  -- ISO-8601; satt når kontoen er midlertidig stengt etter for mange forsøk
  locked_until TEXT,
  created_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL
);
