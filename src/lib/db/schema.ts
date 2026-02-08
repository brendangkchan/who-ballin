import {
  pgTable,
  integer,
  text,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const games = pgTable('games', {
  id: integer('id').primaryKey(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  season: integer('season').notNull(),
  status: text('status').notNull(),
  homeTeamId: integer('home_team_id').notNull(),
  visitorTeamId: integer('visitor_team_id').notNull(),
  homeTeamScore: integer('home_team_score').notNull(),
  visitorTeamScore: integer('visitor_team_score').notNull(),
});

export const playerGameStats = pgTable(
  'player_game_stats',
  {
    id: integer('id').primaryKey(),
    gameId: integer('game_id').notNull(),
    season: integer('season').notNull(),
    gameDate: timestamp('game_date', { withTimezone: true }).notNull(),
    playerId: integer('player_id').notNull(),
    teamId: integer('team_id').notNull(),
    minutes: integer('minutes').notNull(), // seconds
    pts: integer('pts').notNull(),
    reb: integer('reb').notNull(),
    ast: integer('ast').notNull(),
    oreb: integer('oreb').notNull(),
    dreb: integer('dreb').notNull(),
    fgm: integer('fgm').notNull(),
    fga: integer('fga').notNull(),
    fg3m: integer('fg3m').notNull(),
    fg3a: integer('fg3a').notNull(),
    ftm: integer('ftm').notNull(),
    fta: integer('fta').notNull(),
    stl: integer('stl').notNull(),
    blk: integer('blk').notNull(),
    turnover: integer('turnover').notNull(),
    pf: integer('pf').notNull(),
    plusMinus: integer('plus_minus'),
  },
  table => ({
    gamePlayerUnique: uniqueIndex('player_game_stats_game_player_idx').on(
      table.gameId,
      table.playerId
    ),
  })
);

export const playerSeasonTotals = pgTable(
  'player_season_totals',
  {
    playerId: integer('player_id').notNull(),
    season: integer('season').notNull(),
    games: integer('games').notNull(),
    minutes: integer('minutes').notNull(), // seconds
    pts: integer('pts').notNull(),
    reb: integer('reb').notNull(),
    ast: integer('ast').notNull(),
    oreb: integer('oreb').notNull(),
    dreb: integer('dreb').notNull(),
    fgm: integer('fgm').notNull(),
    fga: integer('fga').notNull(),
    fg3m: integer('fg3m').notNull(),
    fg3a: integer('fg3a').notNull(),
    ftm: integer('ftm').notNull(),
    fta: integer('fta').notNull(),
    stl: integer('stl').notNull(),
    blk: integer('blk').notNull(),
    turnover: integer('turnover').notNull(),
    pf: integer('pf').notNull(),
    plusMinus: integer('plus_minus').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.playerId, table.season] }),
  })
);

export const syncState = pgTable('sync_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export type GameRow = typeof games.$inferInsert;
export type PlayerGameStatRow = typeof playerGameStats.$inferInsert;
export type PlayerSeasonTotalsRow = typeof playerSeasonTotals.$inferInsert;
