-- Profildata: XP, nivå, personlige rekorder og statistikk — lagret på
-- kontoen, ikke bare på enheten.
--
-- Alt dette har til nå bare ligget i localStorage (src/game/progress.ts). En
-- spiller som byttet enhet eller ryddet nettleserdata mistet hele profilen —
-- nivået, rekordene, det merkene i profilen regnes ut fra — selv om selve
-- kontoen (brukernavn + PIN, se 0005) lå trygt i databasen hele tiden.
--
-- `data` er hele Progress-objektet som JSON, ikke ett sett kolonner. Formen
-- endrer seg over tid — Stats har fått nye felt uten migrasjon flere ganger,
-- fordi klienten allerede fyller ut det en eldre lagret profil mangler (se
-- `withStats` i progress.ts). Å speile den samme fleksibiliteten her, i
-- stedet for å låse formen i kolonner, unngår en D1-migrasjon hver gang
-- profilen får et nytt felt — se functions/api/profile/index.js for hvor
-- grensa for hva som godtas faktisk ligger.
CREATE TABLE IF NOT EXISTS player_progress (
  username    TEXT PRIMARY KEY COLLATE NOCASE,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
