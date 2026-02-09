CREATE TABLE IF NOT EXISTS "team_season_stats" (
  "team_id" integer NOT NULL,
  "season" integer NOT NULL,
  "conference" text NOT NULL,
  "division" text NOT NULL,
  "wins" integer NOT NULL,
  "losses" integer NOT NULL,
  "win_pct" double precision NOT NULL,
  "points_for" integer NOT NULL,
  "points_against" integer NOT NULL,
  "point_diff" integer NOT NULL,
  "strength_of_schedule" double precision NOT NULL,
  "seed" integer NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  PRIMARY KEY ("team_id", "season")
);
