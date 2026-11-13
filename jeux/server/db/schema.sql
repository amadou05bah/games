-- Historique des parties (l'état en direct des salles reste en mémoire du serveur).
-- Cette base n'est jamais exposée aux clients.

-- POLICE : une ligne par manche
CREATE TABLE IF NOT EXISTS games (
  id              SERIAL PRIMARY KEY,
  room_code       TEXT        NOT NULL,
  game_name       TEXT,
  round           INTEGER     NOT NULL DEFAULT 1,
  player_count    INTEGER     NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  accused_name    TEXT,
  police_correct  BOOLEAN
);
CREATE TABLE IF NOT EXISTS game_players (
  game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_name TEXT    NOT NULL,
  role_name   TEXT    NOT NULL,
  role_type   TEXT    NOT NULL,
  points      INTEGER
);
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS points INTEGER;
CREATE INDEX IF NOT EXISTS idx_games_room ON games(room_code);

-- DÉFIE TA LETTRE : une ligne par partie de 5 tours
CREATE TABLE IF NOT EXISTS lettre_games (
  id          SERIAL PRIMARY KEY,
  room_code   TEXT        NOT NULL,
  categories  TEXT[]      NOT NULL,
  timer       INTEGER     NOT NULL,
  letters     TEXT[],
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS lettre_scores (
  game_id     INTEGER NOT NULL REFERENCES lettre_games(id) ON DELETE CASCADE,
  player_name TEXT    NOT NULL,
  score       INTEGER NOT NULL,
  rank        INTEGER NOT NULL
);
