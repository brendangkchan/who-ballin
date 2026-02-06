import { NextRequest, NextResponse } from 'next/server';
import { subDays, format } from 'date-fns';
import { getAllGames, getLastCompletedGame, getAllStatsForGames, getCurrentNBASeason } from '@/lib/balldontlie';
import { aggregatePlayerStats } from '@/lib/utils';
import { RateLimiter } from '@/lib/rateLimiter';
import { parseFilters } from '@/lib/filters';
import type { Game, GameStats, PlayerWeekStats, DebugInfo } from '@/types/player';

export const revalidate = 3600; // Revalidate every hour

const RATE_LIMIT_PER_MIN = 50;

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function fetchStatsBatched(
  gameIds: number[],
  batchSize: number,
  rateLimiter: RateLimiter,
  debugInfo: DebugInfo
): Promise<GameStats[]> {
  const allStats: GameStats[] = [];
  const batches = chunkArray(gameIds, batchSize);
  debugInfo.batchCount = batches.length;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const startTime = Date.now();

    try {
      const statsData = await getAllStatsForGames(
        batch,
        () => rateLimiter.waitIfNeeded()
      );
      const duration = Date.now() - startTime;

      debugInfo.apiCalls.push({
        endpoint: `/stats (batch ${i + 1}/${batches.length})`,
        status: 200,
        duration,
        timestamp: new Date().toISOString(),
      });

      if (statsData && statsData.length > 0) {
        allStats.push(...(statsData as GameStats[]));
      }
      console.debug('[top-week] stats batch', i + 1, '/', batches.length, ':', (statsData?.length ?? 0), 'stats, total', allStats.length, 'in', duration, 'ms');
    } catch (error: any) {
      console.debug('[top-week] stats batch', i + 1, 'error:', error?.message ?? error);
      const duration = Date.now() - startTime;
      debugInfo.apiCalls.push({
        endpoint: `/stats (batch ${i + 1}/${batches.length})`,
        status: error.status || 500,
        duration,
        timestamp: new Date().toISOString(),
      });
      debugInfo.errors.push(`Error fetching stats batch ${i + 1}: ${error.message}`);
      // Continue with other batches
    }
  }

  return allStats;
}

export async function GET(request: NextRequest) {
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

  try {
    console.debug('[top-week] GET request started');
    const filters = parseFilters(request.nextUrl.searchParams);
    const rateLimiter = new RateLimiter({ maxRequests: RATE_LIMIT_PER_MIN, windowMs: 60000 });
    console.debug('[top-week] filters:', filters);

    debugInfo.warnings.push(
      `Filters: minGames=${filters.minGames}, minPts=${filters.minPts}, minMinutes=${filters.minMinutes}`
    );
    debugInfo.warnings.push(
      `API: rateLimit=${RATE_LIMIT_PER_MIN}/min, all games in last 7 days`
    );
    debugInfo.warnings.push(
      'Qualifying: exclude lost>50% games, exclude negative +/- unless won all'
    );

    // Track API calls
    const trackApiCall = (endpoint: string, status: number, duration: number) => {
      debugInfo.requests++;
      debugInfo.apiCalls.push({
        endpoint,
        status,
        duration,
        timestamp: new Date().toISOString(),
      });
    };

    // Step 1: Determine date range
    const endDate = new Date();
    const startDate = subDays(endDate, 7);
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    debugInfo.dateRange.start = startDateStr;
    debugInfo.dateRange.end = endDateStr;
    console.debug('[top-week] date range:', startDateStr, '..', endDateStr);

    // Add NBA season info to debug
    const nbaSeason = getCurrentNBASeason();
    debugInfo.warnings.push(
      `NBA Season: ${nbaSeason} (calculated from current date: ${new Date().toISOString()})`
    );

    // Step 2: Fetch games from last week
    let gamesCallStart = Date.now();
    let games: Game[] = [];

    try {
      games = await getAllGames(startDateStr, endDateStr);
      const gamesCallDuration = Date.now() - gamesCallStart;
      trackApiCall('/games', 200, gamesCallDuration);
      console.debug('[top-week] games fetch:', games.length, 'games in', gamesCallDuration, 'ms');

      // DEBUG: Log what we got
      debugInfo.warnings.push(
        `Fetched ${games.length} total games from API (before filtering)`
      );
      if (games.length > 0) {
        const statuses = games.reduce((acc: Record<string, number>, g) => {
          acc[g.status] = (acc[g.status] || 0) + 1;
          return acc;
        }, {});
        debugInfo.warnings.push(
          `Game statuses: ${JSON.stringify(statuses)}`
        );
        debugInfo.warnings.push(
          `Date range used: ${startDateStr} to ${endDateStr}`
        );
      } else {
        debugInfo.warnings.push(
          `No games returned from API for date range: ${startDateStr} to ${endDateStr}`
        );
      }
    } catch (error: any) {
      const gamesCallDuration = Date.now() - gamesCallStart;
      trackApiCall('/games', error.status || 500, gamesCallDuration);
      debugInfo.errors.push(`Failed to fetch games: ${error.message}`);
      throw error;
    }

    // Filter to completed games only (all games in last 7 days)
    const beforeFilter = games.length;
    games = games.filter(g => g.status === 'Final');
    console.debug('[top-week] games filter: ', beforeFilter, '->', games.length, '(Final only)');

    // DEBUG: Log filtering results
    if (beforeFilter > 0 && games.length === 0) {
      debugInfo.warnings.push(
        `All ${beforeFilter} games were filtered out (none had status='Final')`
      );
    } else if (beforeFilter > games.length) {
      debugInfo.warnings.push(
        `Filtered ${beforeFilter} games down to ${games.length} (removed non-Final games)`
      );
    }

    debugInfo.gamesProcessed = games.length;

    // If no games found, try fallback
    if (games.length === 0) {
      console.debug('[top-week] no games, trying fallback');
      debugInfo.warnings.push('No games found in last 7 days, trying fallback');
      debugInfo.dateRange.usedFallback = true;

      try {
        const lastGame = await getLastCompletedGame();
        if (lastGame) {
          const fallbackEnd = new Date(lastGame.date);
          const fallbackStart = subDays(fallbackEnd, 7);
          const fallbackStartStr = format(fallbackStart, 'yyyy-MM-dd');
          const fallbackEndStr = format(fallbackEnd, 'yyyy-MM-dd');

          debugInfo.dateRange.start = fallbackStartStr;
          debugInfo.dateRange.end = fallbackEndStr;

          games = await getAllGames(fallbackStartStr, fallbackEndStr);
          games = games.filter(g => g.status === 'Final');
          console.debug('[top-week] fallback games:', games.length);

          debugInfo.gamesProcessed = games.length;
          trackApiCall('/games (fallback)', 200, Date.now() - gamesCallStart);
        }
      } catch (error: any) {
        debugInfo.errors.push(`Fallback failed: ${error.message}`);
      }
    }

    if (games.length === 0) {
      debugInfo.processingTime = Date.now() - startTime;
      return NextResponse.json({
        players: [],
        ...(process.env.NODE_ENV === 'development' && { debug: debugInfo }),
      });
    }

    // Step 3: Fetch stats with batching (all games)
    const gameIds = games.map(g => g.id);
    const batchSize = 50;
    console.debug('[top-week] fetching stats:', gameIds.length, 'games in', Math.ceil(gameIds.length / batchSize), 'batches');

    const allStats = await fetchStatsBatched(
      gameIds,
      batchSize,
      rateLimiter,
      debugInfo
    );

    debugInfo.statsProcessed = allStats.length;
    debugInfo.rateLimitDelays = rateLimiter.getTotalWaitTime();
    console.debug('[top-week] stats fetch complete:', allStats.length, 'stats,', rateLimiter.getTotalWaitTime(), 'ms rate limit delays');

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

    // Step 8: Sort by PER
    filtered.sort((a, b) => b.per - a.per);

    debugInfo.processingTime = Date.now() - startTime;
    console.debug('[top-week] done:', filtered.length, 'players in', debugInfo.processingTime, 'ms');

    const response = {
      players: filtered,
      ...(process.env.NODE_ENV === 'development' && { debug: debugInfo }),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    const errorStack = error.stack || '';
    debugInfo.errors.push(errorMessage);
    debugInfo.processingTime = Date.now() - startTime;

    // Log full error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in /api/players/top-week:', errorMessage);
      console.error('Stack:', errorStack);
      console.error('Debug info:', JSON.stringify(debugInfo, null, 2));
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch top players',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && {
          debug: debugInfo,
          stack: errorStack
        }),
      },
      { status: 500 }
    );
  }
}
