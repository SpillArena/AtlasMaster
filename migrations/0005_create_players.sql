-- Spelarkontoar: brukarnamn og PIN.
--
-- Tavla identifiserte ein spelar med ein streng frå eit tekstfelt. Kven som
-- helst kunne sende inn eit resultat under kva namn som helst, og sidan
-- spørjinga held éi rad per brukarnamn, ville ein høgare falsk poengsum
-- ERSTATTE raden til den verkelege spelaren, ikkje leggje seg ved sida av.
--
-- COLLATE NOCASE på primærnøkkelen gjer to ting på ein gong. Han hindrar at
-- «Kari» og «kari» blir to kontoar, og han rettar opp ein feil som alt fanst:
-- dei to var to separate rader på tavla, og såg ut som duplikat.
CREATE TABLE IF NOT EXISTS players (
  username    TEXT PRIMARY KEY COLLATE NOCASE,
  pin_hash    TEXT NOT NULL,
  pin_salt    TEXT NOT NULL,
  -- kor mange gonger PIN-en er gjeta feil sidan sist rett innlogging
  failed      INTEGER NOT NULL DEFAULT 0,
  -- ISO-8601; sett når kontoen er mellombels stengd etter for mange forsøk
  locked_until TEXT,
  created_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL
);
