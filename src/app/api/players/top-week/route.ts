import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { subDays, format } from 'date-fns';
import { getAllGames, getLastCompletedGame, getAllStatsForGames, getCurrentNBASeason } from '@/lib/balldontlie';
import { aggregatePlayerStats } from '@/lib/utils';
import { parseFilters } from '@/lib/filters';
import type { Game, GameStats, PlayerWeekStats, DebugInfo } from '@/types/player';

export const revalidate = 3600;

const BATCH_SIZE = 20; // Keep under 2MB per cache entry; 50 games ~2.4MB

function getCachedGames(startDateStr: string, endDateStr: string) {
  return unstable_cache(
    async () => {
      const games = await getAllGames(startDateStr, endDateStr);
      return games.filter((g) => g.status === 'Final');
    },
    ['games', startDateStr, endDateStr],
    { revalidate: 86400, tags: ['top-week'] }
  )();
}

function getCachedStatsBatch(
  startDateStr: string,
  endDateStr: string,
  batchIndex: number
) {
  return unstable_cache(
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
    { revalidate: 86400, tags: ['top-week'] }
  )();
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

    // Step 2: Fetch games (cached for 24h)
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
          const fallbackStart = subDays(fallbackEnd, 7);
          activeStart = format(fallbackStart, 'yyyy-MM-dd');
          activeEnd = format(fallbackEnd, 'yyyy-MM-dd');

          debugInfo.dateRange.start = activeStart;
          debugInfo.dateRange.end = activeEnd;

          games = await getCachedGames(activeStart, activeEnd);
          debugInfo.gamesProcessed = games.length;
          console.debug('[top-week] fallback games:', games.length);
        }
      } catch (error: any) {
        debugInfo.errors.push(`Fallback failed: ${error.message}`);
      }
    }

    // Step 3: Fetch stats batches (cached for 24h)
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
      return NextResponse.json({
        players: [],
        ...(process.env.NODE_ENV === 'development' && { debug: debugInfo }),
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

    // Step 9: Limit to top 10
    const players = filtered.slice(0, 10);

    debugInfo.processingTime = Date.now() - startTime;
    console.debug('[top-week] done:', players.length, 'players in', debugInfo.processingTime, 'ms');

    const response = {
      players,
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
