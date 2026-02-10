import 'server-only';

import { unstable_cache } from 'next/cache';
import { subDays, format, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { getCurrentNBASeason } from '@/lib/balldontlie';
import { aggregatePlayerStats } from '@/lib/utils';
import type { Game, GameStats, PlayerWeekStats, DebugInfo } from '@/types/player';
import { getDb } from '@/lib/db/client';
import { createDbAdapter, type DbAdapter } from '@/lib/db/adapter';
import { getSeasonForSync } from '@/lib/sync/seasonSync';
import { buildSeasonStats, buildDeltaStats, type SeasonTotalsRow } from '@/lib/season-stats';
import { calculatePERFromTotals } from '@/lib/per';
import { computePositionTsSummary, POSITION_TS_ATTEMPT_CUTOFF } from '@/lib/position-ts';
import type { PlayerFilters } from '@/lib/filters';
import type { PositionTsSummary } from '@/lib/position-utils';
import { getTeamInfo, getTeamMeta } from '@/lib/team-meta';

export type TopWeekResult = {
  players: PlayerWeekStats[];
  positionAverages?: PositionTsSummary;
  debug?: DebugInfo;
  generatedAt?: string;
};

export class TopWeekError extends Error {
  debug?: DebugInfo;
  originalStack?: string;

  constructor(message: string, debug?: DebugInfo, originalStack?: string) {
    super(message);
    this.name = 'TopWeekError';
    this.debug = debug;
    this.originalStack = originalStack;
  }
}

const TOP_WEEK_TTL_SECONDS = 60 * 60; // Safety valve if nightly revalidate misses.

type DbGameRow = Awaited<ReturnType<DbAdapter['getFinalGamesInRange']>>[number];
type DbStatRow = Awaited<ReturnType<DbAdapter['getPlayerStatsInRange']>>[number];

function formatSecondsToMinutes(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function buildGameFromRow(row: DbGameRow): Game {
  const home = getTeamInfo(row.homeTeamId);
  const visitor = getTeamInfo(row.visitorTeamId);

  return {
    id: row.id,
    date: row.date.toISOString(),
    season: row.season,
    status: row.status,
    home_team: {
      id: home.id,
      abbreviation: home.abbreviation,
      city: home.city,
      name: home.name,
    },
    visitor_team: {
      id: visitor.id,
      abbreviation: visitor.abbreviation,
      city: visitor.city,
      name: visitor.name,
    },
    home_team_score: row.homeTeamScore,
    visitor_team_score: row.visitorTeamScore,
  };
}

function buildStatFromRow(row: DbStatRow): GameStats {
  const firstName = row.firstName?.trim() || 'N/A';
  const lastName = row.lastName?.trim() || 'N/A';
  const position = row.position ?? undefined;
  const team = getTeamInfo(row.teamId);

  return {
    id: row.id,
    game: { id: row.gameId, date: row.gameDate.toISOString() },
    player: {
      id: row.playerId,
      first_name: firstName,
      last_name: lastName,
      ...(position ? { position } : {}),
    },
    team: {
      id: team.id,
      abbreviation: team.abbreviation,
      city: team.city,
      name: team.name,
    },
    pts: row.pts,
    reb: row.reb,
    ast: row.ast,
    fg: row.fgm,
    fga: row.fga,
    fgm: row.fgm,
    ft: row.ftm,
    fta: row.fta,
    ftm: row.ftm,
    min: formatSecondsToMinutes(row.minutes),
    plus_minus: row.plusMinus ?? 0,
    stl: row.stl,
    blk: row.blk,
    tov: row.turnover,
    turnover: row.turnover,
    pf: row.pf,
    fg3: row.fg3m,
    fg3a: row.fg3a,
    fg3m: row.fg3m,
    oreb: row.oreb,
    dreb: row.dreb,
  };
}

async function computeTopWeekPlayers(filters: PlayerFilters): Promise<TopWeekResult> {
  const startTime = Date.now();
  const debugInfo: DebugInfo = {
    requests: 0,
    errors: [],
    gamesProcessed: 0,
    statsProcessed: 0,
    playersFound: 0,
    cacheHit: false,
    dateRange: { start: '', end: '', usedFallback: false },
    batchCount: 0,
    processingTime: 0,
    warnings: [],
    rateLimitDelays: 0,
    apiCalls: [],
  };

  const isDev = process.env.NODE_ENV === 'development';

  try {
    console.debug('[top-week] GET request started');
    console.debug('[top-week] filters:', filters);

    debugInfo.warnings.push(
      `Filters: minGames=${filters.minGames}, minPts=${filters.minPts}, minMinutes=${filters.minMinutes}`
    );
    debugInfo.warnings.push(
      'DB: cached games+stats (end=latest final game), all games in last 7 days'
    );
    debugInfo.warnings.push(
      'Qualifying: exclude lost>50% games, exclude negative +/- unless won all'
    );

    const adapter = createDbAdapter(getDb());

    const lastFinalGameDate = await adapter.getLastFinalGameDate();
    if (!lastFinalGameDate) {
      debugInfo.warnings.push('No final games found in database');
      debugInfo.processingTime = Date.now() - startTime;
      return {
        players: [],
        generatedAt: new Date().toISOString(),
        ...(isDev && { debug: debugInfo }),
      };
    }

    const lastGameDay = startOfDay(lastFinalGameDate);
    const daysSinceLastGame = differenceInDays(startOfDay(new Date()), lastGameDay);
    if (daysSinceLastGame > 30) {
      debugInfo.warnings.push(
        `Fallback skipped: last completed game is ${daysSinceLastGame} days old`
      );
      debugInfo.processingTime = Date.now() - startTime;
      return {
        players: [],
        generatedAt: new Date().toISOString(),
        ...(isDev && { debug: debugInfo }),
      };
    }

    const endDate = endOfDay(lastFinalGameDate);
    const startDate = startOfDay(subDays(endDate, 7));
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    debugInfo.dateRange.start = startDateStr;
    debugInfo.dateRange.end = endDateStr;
    debugInfo.dateRange.usedFallback = daysSinceLastGame > 1;

    const nbaSeason = getCurrentNBASeason();
    debugInfo.warnings.push(
      `NBA Season: ${nbaSeason} (calculated from current date: ${new Date().toISOString()})`
    );

    let gameRows: DbGameRow[] = [];
    try {
      gameRows = await adapter.getFinalGamesInRange(startDate, endDate);
    } catch (error: any) {
      debugInfo.errors.push(`Failed to fetch games: ${error.message}`);
      throw error;
    }

    const missingTeamIds = new Set<number>();
    const games: Game[] = gameRows.map(row => {
      if (!getTeamMeta(row.homeTeamId)) missingTeamIds.add(row.homeTeamId);
      if (!getTeamMeta(row.visitorTeamId)) missingTeamIds.add(row.visitorTeamId);
      return buildGameFromRow(row);
    });
    debugInfo.gamesProcessed = games.length;
    console.debug('[top-week] games:', games.length);

    if (games.length === 0) {
      debugInfo.processingTime = Date.now() - startTime;
      return {
        players: [],
        generatedAt: new Date().toISOString(),
        ...(isDev && { debug: debugInfo }),
      };
    }

    let statRows: DbStatRow[] = [];
    try {
      statRows = await adapter.getPlayerStatsInRange(startDate, endDate);
    } catch (error: any) {
      debugInfo.errors.push(`Failed to fetch stats: ${error.message}`);
      throw error;
    }

    const gameIdSet = new Set(gameRows.map(row => row.id));
    const relevantStatRows = statRows.filter(row => gameIdSet.has(row.gameId));
    const missingPlayerIds = new Set<number>();
    const allStats: GameStats[] = relevantStatRows.map(row => {
      if (!row.firstName || !row.lastName) missingPlayerIds.add(row.playerId);
      if (!getTeamMeta(row.teamId)) missingTeamIds.add(row.teamId);
      return buildStatFromRow(row);
    });

    debugInfo.statsProcessed = allStats.length;
    debugInfo.batchCount = 1;
    console.debug('[top-week] stats:', allStats.length);

    if (missingPlayerIds.size > 0) {
      debugInfo.warnings.push(`Missing player metadata for ${missingPlayerIds.size} player(s)`);
    }
    if (missingTeamIds.size > 0) {
      debugInfo.warnings.push(`Missing team metadata for ${missingTeamIds.size} team(s)`);
    }
    if ((missingPlayerIds.size > 0 || missingTeamIds.size > 0) && !debugInfo.cacheHit) {
      console.warn('[top-week] missing metadata', {
        players: missingPlayerIds.size,
        teams: missingTeamIds.size,
      });
    }

    // Step 4: Group stats by player
    const playerStatsMap = new Map<number, GameStats[]>();
    for (const stat of allStats) {
      const playerId = stat.player.id;
      if (!playerStatsMap.has(playerId)) {
        playerStatsMap.set(playerId, []);
      }
      playerStatsMap.get(playerId)!.push(stat);
    }

    debugInfo.playersFound = playerStatsMap.size;
    console.debug('[top-week] grouped by player:', playerStatsMap.size, 'players');

    // Step 5: Calculate aggregated stats per player
    const playerWeekStats: PlayerWeekStats[] = [];
    for (const [playerId, stats] of playerStatsMap.entries()) {
      if (stats.length === 0) continue;

      try {
        const playerStats = aggregatePlayerStats(stats, games);
        playerWeekStats.push(playerStats);
      } catch (error: any) {
        debugInfo.warnings.push(
          `Failed to aggregate stats for player ${playerId}: ${error.message}`
        );
      }
    }
    console.debug('[top-week] aggregated:', playerWeekStats.length, 'players');

    // Step 6: Filter by min games, min points
    let filtered = playerWeekStats.filter(p => p.games >= filters.minGames && p.totalPts >= filters.minPts);
    console.debug('[top-week] filter minGames/minPts:', playerWeekStats.length, '->', filtered.length);

    // Step 6b: Filter by minutes per game
    const beforeMinutesFilter = filtered.length;
    filtered = filtered.filter(p => {
      return p.totalMinutes / p.games >= filters.minMinutes;
    });
    console.debug('[top-week] filter minMinutes per game:', beforeMinutesFilter, '->', filtered.length);

    // Step 7: Qualifying filters: exclude players who lost >50% of games,
    // and exclude negative +/- unless they won all games
    const beforeQualifying = filtered.length;
    filtered = filtered.filter(p => {
      const wins = p.gameResults.filter(r => r.result === 'W').length;
      const losses = p.gameResults.filter(r => r.result === 'L').length;
      const lostMoreThanHalf = losses > p.games / 2;
      const negativePlusMinus = p.plusMinus < 0;
      const wonAllGames = wins === p.games;

      if (lostMoreThanHalf) return false;
      if (negativePlusMinus && !wonAllGames) return false;
      return true;
    });
    console.debug('[top-week] qualifying filters (win % / +/-):', beforeQualifying, '->', filtered.length);

    // Step 8: Load season-based position TS averages (DB-backed)
    const season = await getSeasonForSync(adapter, new Date());
    let positionAverages: PositionTsSummary | undefined;

    try {
      const cached = await adapter.getPositionTsForSeason(season);
      const guard = cached.find(row => row.positionGroup === 'guard');
      const wing = cached.find(row => row.positionGroup === 'wing');
      const big = cached.find(row => row.positionGroup === 'big');
      const attemptCutoff =
        guard?.attemptCutoff ?? wing?.attemptCutoff ?? big?.attemptCutoff ?? POSITION_TS_ATTEMPT_CUTOFF;

      if (cached.length === 3 && [guard, wing, big].every(Boolean) && attemptCutoff === POSITION_TS_ATTEMPT_CUTOFF) {
        positionAverages = {
          attemptCutoff,
          counts: {
            guard: guard?.playerCount ?? 0,
            forward: wing?.playerCount ?? 0,
            center: big?.playerCount ?? 0,
          },
          averages: {
            guard: guard?.avgTs ?? undefined,
            forward: wing?.avgTs ?? undefined,
            center: big?.avgTs ?? undefined,
          },
        };
      } else {
        const rows = await adapter.getSeasonTotalsWithPositions(season);
        positionAverages = computePositionTsSummary(rows, POSITION_TS_ATTEMPT_CUTOFF);
        await adapter.upsertPositionTs([
          {
            season,
            positionGroup: 'guard',
            attemptCutoff: POSITION_TS_ATTEMPT_CUTOFF,
            avgTs: positionAverages.averages.guard ?? null,
            playerCount: positionAverages.counts.guard,
            updatedAt: new Date(),
          },
          {
            season,
            positionGroup: 'wing',
            attemptCutoff: POSITION_TS_ATTEMPT_CUTOFF,
            avgTs: positionAverages.averages.forward ?? null,
            playerCount: positionAverages.counts.forward,
            updatedAt: new Date(),
          },
          {
            season,
            positionGroup: 'big',
            attemptCutoff: POSITION_TS_ATTEMPT_CUTOFF,
            avgTs: positionAverages.averages.center ?? null,
            playerCount: positionAverages.counts.center,
            updatedAt: new Date(),
          },
        ]);
      }
    } catch (error: any) {
      debugInfo.warnings.push(`Failed to load position TS averages: ${error?.message ?? error}`);
    }

    // Step 9: Sort by adjusted PER (fallback to simplified)
    try {
      const cachedLeagueTotals = await adapter.getCachedLeagueTotals(season);
      const leagueTotals =
        cachedLeagueTotals ?? (await adapter.getSeasonLeagueTotals(season));
      if (leagueTotals) {
        if (!cachedLeagueTotals) {
          await adapter.setCachedLeagueTotals(season, leagueTotals);
        }
        const leaguePer = calculatePERFromTotals({
          pts: leagueTotals.pts,
          reb: leagueTotals.reb,
          ast: leagueTotals.ast,
          stl: leagueTotals.stl,
          blk: leagueTotals.blk,
          tov: leagueTotals.turnover,
          fg: leagueTotals.fgm,
          fga: leagueTotals.fga,
          ft: leagueTotals.ftm,
          fta: leagueTotals.fta,
          pf: leagueTotals.pf,
          minutes: leagueTotals.minutes / 60,
        });
        const scale = leaguePer > 0 ? 15 / leaguePer : 1;
        for (const player of filtered) {
          player.perAdjusted = Number.isFinite(player.per * scale)
            ? player.per * scale
            : player.per;
        }
      }
    } catch (error: any) {
      debugInfo.warnings.push(`Failed to compute adjusted PER: ${error?.message ?? error}`);
    }

    filtered.sort((a, b) => (b.perAdjusted ?? b.per) - (a.perAdjusted ?? a.per));

    // Step 10: Limit to top 10
    const players = filtered.slice(0, 10);

    // Step 11: Attach season averages and deltas
    if (players.length > 0) {
      try {
        const playerIds = players.map(p => p.player.id);
        const seasonRows = await adapter.getSeasonTotalsForPlayers(season, playerIds);
        const byPlayerId = new Map<number, SeasonTotalsRow>();
        for (const row of seasonRows) byPlayerId.set(row.playerId, row);

        for (const player of players) {
          const row = byPlayerId.get(player.player.id);
          if (!row) continue;
          const seasonStats = buildSeasonStats(row);
          player.season = seasonStats;
          player.delta = buildDeltaStats(player, seasonStats);
        }
      } catch (error: any) {
        debugInfo.warnings.push(`Failed to load season averages: ${error?.message ?? error}`);
      }
    }

    debugInfo.processingTime = Date.now() - startTime;
    console.debug('[top-week] done:', players.length, 'players in', debugInfo.processingTime, 'ms');

    return {
      players,
      positionAverages,
      generatedAt: new Date().toISOString(),
      ...(isDev && { debug: debugInfo }),
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    debugInfo.errors.push(errorMessage);
    debugInfo.processingTime = Date.now() - startTime;

    if (isDev) {
      console.error('Error in /api/players/top-week:', errorMessage);
      console.error('Stack:', error.stack || '');
      console.error('Debug info:', JSON.stringify(debugInfo, null, 2));
    }

    throw new TopWeekError(errorMessage, isDev ? debugInfo : undefined, error.stack || '');
  }
}

export async function getTopWeekPlayers(filters: PlayerFilters): Promise<TopWeekResult> {
  const cacheKey = [
    'top-week',
    `minGames:${filters.minGames}`,
    `minPts:${filters.minPts}`,
    `minMinutes:${filters.minMinutes}`,
  ];

  return unstable_cache(
    () => computeTopWeekPlayers(filters),
    cacheKey,
    { revalidate: TOP_WEEK_TTL_SECONDS, tags: ['top-week'] }
  )().catch(async () => computeTopWeekPlayers(filters));
}
