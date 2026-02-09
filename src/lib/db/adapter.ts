import { and, eq, gte, inArray, max, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  games,
  players,
  playerGameStats,
  playerSeasonTotals,
  positionTs,
  syncState,
  teamSeasonStats,
  type GameRow,
  type PlayerGameStatRow,
  type PlayerRow,
  type PositionTsRow,
  type TeamSeasonStatsRow,
} from './schema';

export type DbAdapter = {
  upsertGames: (rows: GameRow[]) => Promise<number>;
  upsertPlayers: (rows: PlayerRow[]) => Promise<number>;
  upsertPlayerGameStats: (rows: PlayerGameStatRow[]) => Promise<number>;
  getMaxSeasonInRecentGames: (sinceDate: Date) => Promise<number | null>;
  getLastGameDateForSeason: (season: number) => Promise<Date | null>;
  getSeasonTotalsForPlayers: (season: number, playerIds: number[]) => Promise<{
    playerId: number;
    season: number;
    games: number;
    minutes: number;
    pts: number;
    reb: number;
    ast: number;
    oreb: number;
    dreb: number;
    stl: number;
    blk: number;
    turnover: number;
    pf: number;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
    ftm: number;
    fta: number;
    plusMinus: number;
  }[]>;
  getSeasonLeagueTotals: (season: number) => Promise<{
    minutes: number;
    pts: number;
    reb: number;
    ast: number;
    oreb: number;
    dreb: number;
    stl: number;
    blk: number;
    turnover: number;
    pf: number;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
    ftm: number;
    fta: number;
  } | null>;
  getCachedLeagueTotals: (season: number) => Promise<{
    minutes: number;
    pts: number;
    reb: number;
    ast: number;
    oreb: number;
    dreb: number;
    stl: number;
    blk: number;
    turnover: number;
    pf: number;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
    ftm: number;
    fta: number;
  } | null>;
  setCachedLeagueTotals: (season: number, totals: {
    minutes: number;
    pts: number;
    reb: number;
    ast: number;
    oreb: number;
    dreb: number;
    stl: number;
    blk: number;
    turnover: number;
    pf: number;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
    ftm: number;
    fta: number;
  }) => Promise<void>;
  updateSeasonTotalsForPlayers: (season: number, playerIds: number[]) => Promise<number>;
  rebuildSeasonTotals: (season: number) => Promise<number>;
  getSeasonTotalsWithPositions: (season: number) => Promise<{
    playerId: number;
    pts: number;
    fga: number;
    fta: number;
    position: string | null;
  }[]>;
  getPositionTsForSeason: (season: number) => Promise<{
    season: number;
    positionGroup: string;
    attemptCutoff: number;
    avgTs: number | null;
    playerCount: number;
  }[]>;
  upsertPositionTs: (rows: PositionTsRow[]) => Promise<number>;
  getSyncState: (key: string) => Promise<unknown | null>;
  upsertSyncState: (key: string, value: unknown) => Promise<void>;
  getGamesForSeason: (season: number) => Promise<GameRow[]>;
  upsertTeamSeasonStats: (rows: TeamSeasonStatsRow[]) => Promise<number>;
};

export function createDbAdapter(db: NeonHttpDatabase<Record<string, never>>): DbAdapter {
  return {
    async upsertGames(rows) {
      if (rows.length === 0) return 0;
      await db
        .insert(games)
        .values(rows)
        .onConflictDoUpdate({
          target: games.id,
          set: {
            date: sql`excluded.date`,
            season: sql`excluded.season`,
            status: sql`excluded.status`,
            homeTeamId: sql`excluded.home_team_id`,
            visitorTeamId: sql`excluded.visitor_team_id`,
            homeTeamScore: sql`excluded.home_team_score`,
            visitorTeamScore: sql`excluded.visitor_team_score`,
          },
        });
      return rows.length;
    },
    async upsertPlayers(rows) {
      if (rows.length === 0) return 0;
      await db
        .insert(players)
        .values(rows)
        .onConflictDoUpdate({
          target: players.id,
          set: {
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            position: sql`excluded.position`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      return rows.length;
    },
    async upsertPlayerGameStats(rows) {
      if (rows.length === 0) return 0;
      await db
        .insert(playerGameStats)
        .values(rows)
        .onConflictDoUpdate({
          target: playerGameStats.id,
          set: {
            gameId: sql`excluded.game_id`,
            season: sql`excluded.season`,
            gameDate: sql`excluded.game_date`,
            playerId: sql`excluded.player_id`,
            teamId: sql`excluded.team_id`,
            minutes: sql`excluded.minutes`,
            pts: sql`excluded.pts`,
            reb: sql`excluded.reb`,
            ast: sql`excluded.ast`,
            oreb: sql`excluded.oreb`,
            dreb: sql`excluded.dreb`,
            fgm: sql`excluded.fgm`,
            fga: sql`excluded.fga`,
            fg3m: sql`excluded.fg3m`,
            fg3a: sql`excluded.fg3a`,
            ftm: sql`excluded.ftm`,
            fta: sql`excluded.fta`,
            stl: sql`excluded.stl`,
            blk: sql`excluded.blk`,
            turnover: sql`excluded.turnover`,
            pf: sql`excluded.pf`,
            plusMinus: sql`excluded.plus_minus`,
          },
        });
      return rows.length;
    },
    async getMaxSeasonInRecentGames(sinceDate) {
      const result = await db
        .select({ value: max(games.season) })
        .from(games)
        .where(gte(games.date, sinceDate));
      return result[0]?.value ?? null;
    },
    async getLastGameDateForSeason(season) {
      const result = await db
        .select({ value: max(games.date) })
        .from(games)
        .where(eq(games.season, season));
      return result[0]?.value ?? null;
    },
    async getSeasonTotalsForPlayers(season, playerIds) {
      if (playerIds.length === 0) return [];
      const uniqueIds = Array.from(new Set(playerIds));
      return db
        .select({
          playerId: playerSeasonTotals.playerId,
          season: playerSeasonTotals.season,
          games: playerSeasonTotals.games,
          minutes: playerSeasonTotals.minutes,
          pts: playerSeasonTotals.pts,
          reb: playerSeasonTotals.reb,
          ast: playerSeasonTotals.ast,
          oreb: playerSeasonTotals.oreb,
          dreb: playerSeasonTotals.dreb,
          stl: playerSeasonTotals.stl,
          blk: playerSeasonTotals.blk,
          turnover: playerSeasonTotals.turnover,
          pf: playerSeasonTotals.pf,
          fgm: playerSeasonTotals.fgm,
          fga: playerSeasonTotals.fga,
          fg3m: playerSeasonTotals.fg3m,
          fg3a: playerSeasonTotals.fg3a,
          ftm: playerSeasonTotals.ftm,
          fta: playerSeasonTotals.fta,
          plusMinus: playerSeasonTotals.plusMinus,
        })
        .from(playerSeasonTotals)
        .where(and(eq(playerSeasonTotals.season, season), inArray(playerSeasonTotals.playerId, uniqueIds)));
    },
    async getSeasonLeagueTotals(season) {
      const rows = await db
        .select({
          minutes: sql<number>`coalesce(sum(${playerSeasonTotals.minutes}), 0)`,
          pts: sql<number>`coalesce(sum(${playerSeasonTotals.pts}), 0)`,
          reb: sql<number>`coalesce(sum(${playerSeasonTotals.reb}), 0)`,
          ast: sql<number>`coalesce(sum(${playerSeasonTotals.ast}), 0)`,
          oreb: sql<number>`coalesce(sum(${playerSeasonTotals.oreb}), 0)`,
          dreb: sql<number>`coalesce(sum(${playerSeasonTotals.dreb}), 0)`,
          stl: sql<number>`coalesce(sum(${playerSeasonTotals.stl}), 0)`,
          blk: sql<number>`coalesce(sum(${playerSeasonTotals.blk}), 0)`,
          turnover: sql<number>`coalesce(sum(${playerSeasonTotals.turnover}), 0)`,
          pf: sql<number>`coalesce(sum(${playerSeasonTotals.pf}), 0)`,
          fgm: sql<number>`coalesce(sum(${playerSeasonTotals.fgm}), 0)`,
          fga: sql<number>`coalesce(sum(${playerSeasonTotals.fga}), 0)`,
          fg3m: sql<number>`coalesce(sum(${playerSeasonTotals.fg3m}), 0)`,
          fg3a: sql<number>`coalesce(sum(${playerSeasonTotals.fg3a}), 0)`,
          ftm: sql<number>`coalesce(sum(${playerSeasonTotals.ftm}), 0)`,
          fta: sql<number>`coalesce(sum(${playerSeasonTotals.fta}), 0)`,
        })
        .from(playerSeasonTotals)
        .where(eq(playerSeasonTotals.season, season));
      return rows[0] ?? null;
    },
    async getCachedLeagueTotals(season) {
      const key = `league_totals:${season}`;
      const cached = await db
        .select({ value: syncState.value })
        .from(syncState)
        .where(eq(syncState.key, key));
      return (cached[0]?.value as any) ?? null;
    },
    async setCachedLeagueTotals(season, totals) {
      const key = `league_totals:${season}`;
      await db
        .insert(syncState)
        .values({ key, value: totals, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: syncState.key,
          set: {
            value: sql`excluded.value`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    },
    async updateSeasonTotalsForPlayers(season, playerIds) {
      if (playerIds.length === 0) return 0;
      const uniqueIds = Array.from(new Set(playerIds));

      const rows = await db
        .select({
          playerId: playerGameStats.playerId,
          season: playerGameStats.season,
          games: sql<number>`count(*)`,
          minutes: sql<number>`coalesce(sum(${playerGameStats.minutes}), 0)`,
          pts: sql<number>`coalesce(sum(${playerGameStats.pts}), 0)`,
          reb: sql<number>`coalesce(sum(${playerGameStats.reb}), 0)`,
          ast: sql<number>`coalesce(sum(${playerGameStats.ast}), 0)`,
          oreb: sql<number>`coalesce(sum(${playerGameStats.oreb}), 0)`,
          dreb: sql<number>`coalesce(sum(${playerGameStats.dreb}), 0)`,
          fgm: sql<number>`coalesce(sum(${playerGameStats.fgm}), 0)`,
          fga: sql<number>`coalesce(sum(${playerGameStats.fga}), 0)`,
          fg3m: sql<number>`coalesce(sum(${playerGameStats.fg3m}), 0)`,
          fg3a: sql<number>`coalesce(sum(${playerGameStats.fg3a}), 0)`,
          ftm: sql<number>`coalesce(sum(${playerGameStats.ftm}), 0)`,
          fta: sql<number>`coalesce(sum(${playerGameStats.fta}), 0)`,
          stl: sql<number>`coalesce(sum(${playerGameStats.stl}), 0)`,
          blk: sql<number>`coalesce(sum(${playerGameStats.blk}), 0)`,
          turnover: sql<number>`coalesce(sum(${playerGameStats.turnover}), 0)`,
          pf: sql<number>`coalesce(sum(${playerGameStats.pf}), 0)`,
          plusMinus: sql<number>`coalesce(sum(${playerGameStats.plusMinus}), 0)`,
        })
        .from(playerGameStats)
        .where(and(eq(playerGameStats.season, season), inArray(playerGameStats.playerId, uniqueIds)))
        .groupBy(playerGameStats.playerId, playerGameStats.season);

      if (rows.length === 0) return 0;

      await db
        .insert(playerSeasonTotals)
        .values(
          rows.map(row => ({
            playerId: row.playerId,
            season: row.season,
            games: row.games,
            minutes: row.minutes,
            pts: row.pts,
            reb: row.reb,
            ast: row.ast,
            oreb: row.oreb,
            dreb: row.dreb,
            fgm: row.fgm,
            fga: row.fga,
            fg3m: row.fg3m,
            fg3a: row.fg3a,
            ftm: row.ftm,
            fta: row.fta,
            stl: row.stl,
            blk: row.blk,
            turnover: row.turnover,
            pf: row.pf,
            plusMinus: row.plusMinus,
            updatedAt: new Date(),
          }))
        )
        .onConflictDoUpdate({
          target: [playerSeasonTotals.playerId, playerSeasonTotals.season],
          set: {
            games: sql`excluded.games`,
            minutes: sql`excluded.minutes`,
            pts: sql`excluded.pts`,
            reb: sql`excluded.reb`,
            ast: sql`excluded.ast`,
            oreb: sql`excluded.oreb`,
            dreb: sql`excluded.dreb`,
            fgm: sql`excluded.fgm`,
            fga: sql`excluded.fga`,
            fg3m: sql`excluded.fg3m`,
            fg3a: sql`excluded.fg3a`,
            ftm: sql`excluded.ftm`,
            fta: sql`excluded.fta`,
            stl: sql`excluded.stl`,
            blk: sql`excluded.blk`,
            turnover: sql`excluded.turnover`,
            pf: sql`excluded.pf`,
            plusMinus: sql`excluded.plus_minus`,
            updatedAt: sql`excluded.updated_at`,
          },
        });

      return rows.length;
    },
    async rebuildSeasonTotals(season) {
      const rows = await db
        .select({
          playerId: playerGameStats.playerId,
          season: playerGameStats.season,
          games: sql<number>`count(*)`,
          minutes: sql<number>`coalesce(sum(${playerGameStats.minutes}), 0)`,
          pts: sql<number>`coalesce(sum(${playerGameStats.pts}), 0)`,
          reb: sql<number>`coalesce(sum(${playerGameStats.reb}), 0)`,
          ast: sql<number>`coalesce(sum(${playerGameStats.ast}), 0)`,
          oreb: sql<number>`coalesce(sum(${playerGameStats.oreb}), 0)`,
          dreb: sql<number>`coalesce(sum(${playerGameStats.dreb}), 0)`,
          fgm: sql<number>`coalesce(sum(${playerGameStats.fgm}), 0)`,
          fga: sql<number>`coalesce(sum(${playerGameStats.fga}), 0)`,
          fg3m: sql<number>`coalesce(sum(${playerGameStats.fg3m}), 0)`,
          fg3a: sql<number>`coalesce(sum(${playerGameStats.fg3a}), 0)`,
          ftm: sql<number>`coalesce(sum(${playerGameStats.ftm}), 0)`,
          fta: sql<number>`coalesce(sum(${playerGameStats.fta}), 0)`,
          stl: sql<number>`coalesce(sum(${playerGameStats.stl}), 0)`,
          blk: sql<number>`coalesce(sum(${playerGameStats.blk}), 0)`,
          turnover: sql<number>`coalesce(sum(${playerGameStats.turnover}), 0)`,
          pf: sql<number>`coalesce(sum(${playerGameStats.pf}), 0)`,
          plusMinus: sql<number>`coalesce(sum(${playerGameStats.plusMinus}), 0)`,
        })
        .from(playerGameStats)
        .where(eq(playerGameStats.season, season))
        .groupBy(playerGameStats.playerId, playerGameStats.season);

      if (rows.length === 0) return 0;

      await db
        .insert(playerSeasonTotals)
        .values(
          rows.map(row => ({
            playerId: row.playerId,
            season: row.season,
            games: row.games,
            minutes: row.minutes,
            pts: row.pts,
            reb: row.reb,
            ast: row.ast,
            oreb: row.oreb,
            dreb: row.dreb,
            fgm: row.fgm,
            fga: row.fga,
            fg3m: row.fg3m,
            fg3a: row.fg3a,
            ftm: row.ftm,
            fta: row.fta,
            stl: row.stl,
            blk: row.blk,
            turnover: row.turnover,
            pf: row.pf,
            plusMinus: row.plusMinus,
            updatedAt: new Date(),
          }))
        )
        .onConflictDoUpdate({
          target: [playerSeasonTotals.playerId, playerSeasonTotals.season],
          set: {
            games: sql`excluded.games`,
            minutes: sql`excluded.minutes`,
            pts: sql`excluded.pts`,
            reb: sql`excluded.reb`,
            ast: sql`excluded.ast`,
            oreb: sql`excluded.oreb`,
            dreb: sql`excluded.dreb`,
            fgm: sql`excluded.fgm`,
            fga: sql`excluded.fga`,
            fg3m: sql`excluded.fg3m`,
            fg3a: sql`excluded.fg3a`,
            ftm: sql`excluded.ftm`,
            fta: sql`excluded.fta`,
            stl: sql`excluded.stl`,
            blk: sql`excluded.blk`,
            turnover: sql`excluded.turnover`,
            pf: sql`excluded.pf`,
            plusMinus: sql`excluded.plus_minus`,
            updatedAt: sql`excluded.updated_at`,
          },
        });

      return rows.length;
    },
    async getSeasonTotalsWithPositions(season) {
      return db
        .select({
          playerId: playerSeasonTotals.playerId,
          pts: playerSeasonTotals.pts,
          fga: playerSeasonTotals.fga,
          fta: playerSeasonTotals.fta,
          position: players.position,
        })
        .from(playerSeasonTotals)
        .leftJoin(players, eq(players.id, playerSeasonTotals.playerId))
        .where(eq(playerSeasonTotals.season, season));
    },
    async getPositionTsForSeason(season) {
      return db
        .select({
          season: positionTs.season,
          positionGroup: positionTs.positionGroup,
          attemptCutoff: positionTs.attemptCutoff,
          avgTs: positionTs.avgTs,
          playerCount: positionTs.playerCount,
        })
        .from(positionTs)
        .where(eq(positionTs.season, season));
    },
    async upsertPositionTs(rows) {
      if (rows.length === 0) return 0;
      await db
        .insert(positionTs)
        .values(rows)
        .onConflictDoUpdate({
          target: [positionTs.season, positionTs.positionGroup],
          set: {
            attemptCutoff: sql`excluded.attempt_cutoff`,
            avgTs: sql`excluded.avg_ts`,
            playerCount: sql`excluded.player_count`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      return rows.length;
    },
    async getSyncState(key) {
      const result = await db
        .select({ value: syncState.value })
        .from(syncState)
        .where(eq(syncState.key, key));
      return result[0]?.value ?? null;
    },
    async getGamesForSeason(season) {
      return db
        .select({
          id: games.id,
          date: games.date,
          season: games.season,
          status: games.status,
          homeTeamId: games.homeTeamId,
          visitorTeamId: games.visitorTeamId,
          homeTeamScore: games.homeTeamScore,
          visitorTeamScore: games.visitorTeamScore,
        })
        .from(games)
        .where(eq(games.season, season));
    },
    async upsertSyncState(key, value) {
      await db
        .insert(syncState)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: syncState.key,
          set: {
            value: sql`excluded.value`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    },
    async upsertTeamSeasonStats(rows) {
      if (rows.length === 0) return 0;
      await db
        .insert(teamSeasonStats)
        .values(rows)
        .onConflictDoUpdate({
          target: [teamSeasonStats.teamId, teamSeasonStats.season],
          set: {
            conference: sql`excluded.conference`,
            division: sql`excluded.division`,
            wins: sql`excluded.wins`,
            losses: sql`excluded.losses`,
            winPct: sql`excluded.win_pct`,
            pointsFor: sql`excluded.points_for`,
            pointsAgainst: sql`excluded.points_against`,
            pointDiff: sql`excluded.point_diff`,
            strengthOfSchedule: sql`excluded.strength_of_schedule`,
            seed: sql`excluded.seed`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      return rows.length;
    },
  };
}
