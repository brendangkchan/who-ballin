CREATE INDEX IF NOT EXISTS "games_date_idx" ON "games" USING btree ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_game_stats_game_date_idx" ON "player_game_stats" USING btree ("game_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_game_stats_season_idx" ON "player_game_stats" USING btree ("season");
