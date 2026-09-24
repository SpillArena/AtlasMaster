CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    username TEXT NOT NULL,
    category TEXT NOT NULL,
    mode TEXT NOT NULL,
    pace TEXT NOT NULL,
    score INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    total INTEGER NOT NULL,
    mistakes INTEGER NOT NULL,
    best_streak INTEGER NOT NULL,
    elapsed_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score_timestamp
    ON leaderboard_entries (score DESC, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_category_score
    ON leaderboard_entries (category, score DESC, timestamp DESC);
