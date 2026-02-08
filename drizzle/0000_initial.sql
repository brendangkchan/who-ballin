CREATE TABLE IF NOT EXISTS "games" (
  "id" integer PRIMARY KEY NOT NULL,
  "date" timestamptz NOT NULL,
  "season" integer NOT NULL,
  "status" text NOT NULL,
  "home_team_id" integer NOT NULL,
  "visitor_team_id" integer NOT NULL,
  "home_team_score" integer NOT NULL,
  "visitor_team_score" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "player_game_stats" (
  "id" integer PRIMARY KEY NOT NULL,
  "game_id" integer NOT NULL,
  "season" integer NOT NULL,
  "game_date" timestamptz NOT NULL,
  "player_id" integer NOT NULL,
  "team_id" integer NOT NULL,
  "minutes" integer NOT NULL,
  "pts" integer NOT NULL,
  "reb" integer NOT NULL,
  "ast" integer NOT NULL,
  "oreb" integer NOT NULL,
  "dreb" integer NOT NULL,
  "fgm" integer NOT NULL,
  "fga" integer NOT NULL,
  "fg3m" integer NOT NULL,
  "fg3a" integer NOT NULL,
  "ftm" integer NOT NULL,
  "fta" integer NOT NULL,
  "stl" integer NOT NULL,
  "blk" integer NOT NULL,
  "turnover" integer NOT NULL,
  "pf" integer NOT NULL,
  "plus_minus" integer
);

CREATE UNIQUE INDEX IF NOT EXISTS "player_game_stats_game_player_idx"
  ON "player_game_stats" ("game_id", "player_id");

CREATE TABLE IF NOT EXISTS "player_season_totals" (
  "player_id" integer NOT NULL,
  "season" integer NOT NULL,
  "games" integer NOT NULL,
  "minutes" integer NOT NULL,
  "pts" integer NOT NULL,
  "reb" integer NOT NULL,
  "ast" integer NOT NULL,
  "oreb" integer NOT NULL,
  "dreb" integer NOT NULL,
  "fgm" integer NOT NULL,
  "fga" integer NOT NULL,
  "fg3m" integer NOT NULL,
  "fg3a" integer NOT NULL,
  "ftm" integer NOT NULL,
  "fta" integer NOT NULL,
  "stl" integer NOT NULL,
  "blk" integer NOT NULL,
  "turnover" integer NOT NULL,
  "pf" integer NOT NULL,
  "plus_minus" integer NOT NULL,
  "updated_at" timestamptz NOT NULL,
  PRIMARY KEY ("player_id", "season")
);

CREATE TABLE IF NOT EXISTS "sync_state" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL
);
