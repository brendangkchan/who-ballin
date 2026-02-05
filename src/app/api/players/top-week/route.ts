import { NextRequest, NextResponse } from 'next/server';
import { subDays, format } from 'date-fns';
import { getAllGames, getLastCompletedGame, getStatsForGames, getCurrentNBASeason } from '@/lib/balldontlie';
import { aggregatePlayerStats } from '@/lib/utils';
import { RateLimiter } from '@/lib/rateLimiter';
import type { Game, GameStats, PlayerWeekStats, DebugInfo } from '@/types/player';

export const revalidate = 3600; // Revalidate every hour

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
    await rateLimiter.waitIfNeeded();

    const batch = batches[i];
    const startTime = Date.now();
    
    try {
      const statsData = await getStatsForGames(batch);
      const duration = Date.now() - startTime;
      
      debugInfo.apiCalls.push({
        endpoint: `/stats (batch ${i + 1}/${batches.length})`,
        status: 200,
        duration,
        timestamp: new Date().toISOString(),
      });

      if (statsData.data) {
        allStats.push(...(statsData.data as GameStats[]));
      }
    } catch (error: any) {
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

    // Filter to completed games only, limit to 110
    const beforeFilter = games.length;
    games = games
      .filter(g => g.status === 'Final')
      .slice(0, 110);
    
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
          games = games
            .filter(g => g.status === 'Final')
            .slice(0, 110);
          
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

    // Step 3: Fetch stats with batching
    const gameIds = games.map(g => g.id);
    const rateLimiter = new RateLimiter();
    const batchSize = 50; // Start with 50, adjust if needed

    const allStats = await fetchStatsBatched(
      gameIds,
      batchSize,
      rateLimiter,
      debugInfo
    );

    debugInfo.statsProcessed = allStats.length;
    debugInfo.rateLimitDelays = rateLimiter.getTotalWaitTime();

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

    // Step 6: Sort by PER (all players, no limit)
    playerWeekStats.sort((a, b) => b.per - a.per);

    debugInfo.processingTime = Date.now() - startTime;

    const response = {
      players: playerWeekStats,
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
