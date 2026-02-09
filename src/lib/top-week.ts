import 'server-only';

import { unstable_cache } from 'next/cache';
import { subDays, format, differenceInDays } from 'date-fns';
import { getAllGames, getLastCompletedGame, getAllStatsForGames, getCurrentNBASeason } from '@/lib/balldontlie';
import { aggregatePlayerStats } from '@/lib/utils';
import type { Game, GameStats, PlayerWeekStats, DebugInfo } from '@/types/player';
import { getDb } from '@/lib/db/client';
import { createDbAdapter } from '@/lib/db/adapter';
import { getSeasonForSync } from '@/lib/sync/seasonSync';
import { buildSeasonStats, buildDeltaStats, type SeasonTotalsRow } from '@/lib/season-stats';
import { calculatePERFromTotals } from '@/lib/per';
import { computePositionTsSummary, POSITION_TS_ATTEMPT_CUTOFF } from '@/lib/position-ts';
import type { PlayerFilters } from '@/lib/filters';
import type { PositionTsSummary } from '@/lib/position-utils';

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

const BATCH_SIZE = 20; // Keep under 2MB per cache entry; 50 games ~2.4MB
const TOP_WEEK_TTL_SECONDS = 60 * 60; // Safety valve if nightly revalidate misses.

function getCachedGames(startDateStr: string, endDateStr: string) {
  const cached = unstable_cache(
    async () => {
      const games = await getAllGames(startDateStr, endDateStr);
      return games.filter((g) => g.status === 'Final');
    },
    ['games', startDateStr, endDateStr],
    { revalidate: false, tags: ['top-week'] }
  );

  return cached().catch(async () => {
    const games = await getAllGames(startDateStr, endDateStr);
    return games.filter((g) => g.status === 'Final');
  });
}

function getCachedStatsBatch(
  startDateStr: string,
  endDateStr: string,
  batchIndex: number
) {
  const cached = unstable_cache(
    async () => {
      const games = await getCachedGames(startDateStr, endDateStr);
      const gameIds = games.map((g) => g.id);
      const batch = gameIds.slice(
        batchIndex * BATCH_SIZE,
        (batchIndex + 1) * BATCH_SIZE
      );
      if (batch.length === 0) return [];
      const statsData = await getAllStatsForGames(batch, undefined);
      return (statsData ?? []) as GameStats[];
    },
    ['stats', startDateStr, endDateStr, String(batchIndex)],
    { revalidate: false, tags: ['top-week'] }
  );

  return cached().catch(async () => {
    const games = await getCachedGames(startDateStr, endDateStr);
    const gameIds = games.map((g) => g.id);
    const batch = gameIds.slice(
      batchIndex * BATCH_SIZE,
      (batchIndex + 1) * BATCH_SIZE
    );
    if (batch.length === 0) return [];
    const statsData = await getAllStatsForGames(batch, undefined);
    return (statsData ?? []) as GameStats[];
  });
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
      'API: cached games+stats (end=yesterday), all games in last 7 days'
    );
    debugInfo.warnings.push(
      'Qualifying: exclude lost>50% games, exclude negative +/- unless won all'
    );

    // Step 1: Determine date range (end = yesterday so all games are completed)
    const endDate = subDays(new Date(), 1);
    const startDate = subDays(endDate, 7);
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    debugInfo.dateRange.start = startDateStr;
    debugInfo.dateRange.end = endDateStr;
    console.debug('[top-week] date range:', startDateStr, '..', endDateStr);

    const nbaSeason = getCurrentNBASeason();
    debugInfo.warnings.push(
      `NBA Season: ${nbaSeason} (calculated from current date: ${new Date().toISOString()})`
    );

    // Step 2: Fetch games (cached)
    let games: Game[] = [];
    let activeStart = startDateStr;
    let activeEnd = endDateStr;

    try {
      games = await getCachedGames(startDateStr, endDateStr);
      debugInfo.gamesProcessed = games.length;
      console.debug('[top-week] games:', games.length);
    } catch (error: any) {
      debugInfo.errors.push(`Failed to fetch games: ${error.message}`);
      throw error;
    }

    // If no games found, try fallback (off-season etc.)
    if (games.length === 0) {
      console.debug('[top-week] no games, trying fallback');
      debugInfo.warnings.push('No games found, trying fallback');
      debugInfo.dateRange.usedFallback = true;

      try {
        const lastGame = await getLastCompletedGame();
        if (lastGame) {
          const fallbackEnd = new Date(lastGame.date);
          const daysSinceLastGame = differenceInDays(new Date(), fallbackEnd);
          if (daysSinceLastGame > 30) {
            debugInfo.warnings.push(
              `Fallback skipped: last completed game is ${daysSinceLastGame} days old`
            );
          } else {
            const fallbackStart = subDays(fallbackEnd, 7);
            activeStart = format(fallbackStart, 'yyyy-MM-dd');
            activeEnd = format(fallbackEnd, 'yyyy-MM-dd');

            debugInfo.dateRange.start = activeStart;
            debugInfo.dateRange.end = activeEnd;

            games = await getCachedGames(activeStart, activeEnd);
            debugInfo.gamesProcessed = games.length;
            console.debug('[top-week] fallback games:', games.length);
          }
        }
      } catch (error: any) {
        debugInfo.errors.push(`Fallback failed: ${error.message}`);
      }
    }

    // Step 3: Fetch stats batches (cached)
    let allStats: GameStats[] = [];
    const numBatches = Math.ceil(games.length / BATCH_SIZE);
    debugInfo.batchCount = numBatches;

    try {
      for (let i = 0; i < numBatches; i++) {
        const batch = await getCachedStatsBatch(activeStart, activeEnd, i);
        allStats.push(...batch);
      }
      debugInfo.statsProcessed = allStats.length;
      debugInfo.warnings.push(
        `Fetched ${games.length} games, ${allStats.length} stats (cached)`
      );
      console.debug('[top-week] stats:', allStats.length);
    } catch (error: any) {
      debugInfo.errors.push(`Failed to fetch stats: ${error.message}`);
      throw error;
    }

    if (games.length === 0) {
      debugInfo.processingTime = Date.now() - startTime;
      return {
        players: [],
        generatedAt: new Date().toISOString(),
        ...(isDev && { debug: debugInfo }),
      };
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

    // Step 6: Filter by min games, min points, min minutes
    let filtered = playerWeekStats.filter(
      p =>
        p.games >= filters.minGames &&
        p.totalPts >= filters.minPts &&
        p.totalMinutes >= filters.minMinutes
    );
    console.debug('[top-week] filter minGames/minPts/minMinutes:', playerWeekStats.length, '->', filtered.length);

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
    const adapter = createDbAdapter(getDb());
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
