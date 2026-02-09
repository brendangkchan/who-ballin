CREATE TABLE "games" (
	"id" integer PRIMARY KEY NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"season" integer NOT NULL,
	"status" text NOT NULL,
	"home_team_id" integer NOT NULL,
	"visitor_team_id" integer NOT NULL,
	"home_team_score" integer NOT NULL,
	"visitor_team_score" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_game_stats" (
	"id" integer PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"season" integer NOT NULL,
	"game_date" timestamp with time zone NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "player_season_totals" (
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
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "player_season_totals_player_id_season_pk" PRIMARY KEY("player_id","season")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"position" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_ts" (
	"season" integer NOT NULL,
	"position_group" text NOT NULL,
	"attempt_cutoff" integer NOT NULL,
	"avg_ts" double precision,
	"player_count" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "position_ts_season_position_group_pk" PRIMARY KEY("season","position_group")
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_season_stats" (
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
	CONSTRAINT "team_season_stats_team_id_season_pk" PRIMARY KEY("team_id","season")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "player_game_stats_game_player_idx" ON "player_game_stats" USING btree ("game_id","player_id");