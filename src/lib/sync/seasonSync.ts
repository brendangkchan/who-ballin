import { format, startOfDay, subDays } from 'date-fns';
import type { DbAdapter } from '@/lib/db/adapter';
import type { GameRow, PlayerGameStatRow } from '@/lib/db/schema';
import { createTokenBucket } from './rateLimiter';
import { fetchWithRetry } from './fetchWithRetry';
import { logEvent } from './logger';

const API_BASE = 'https://api.balldontlie.io';
const API_KEY = process.env.BALLDONTLIE_API_KEY;

const DEFAULT_BATCH_SIZE = 40;
const RATE_LIMIT_PER_MIN = 60;

type SyncMode = 'incremental' | 'backfill';

type SyncOptions = {
  db: DbAdapter;
  dryRun?: boolean;
  now?: Date;
  batchSize?: number;
  mode?: SyncMode;
  backfillStart?: Date;
  backfillEnd?: Date;
  maxRetries?: number;
};

type GameApi = {
  id: number;
  date: string;
  season: number;
  status: string;
  home_team: { id: number };
  visitor_team: { id: number };
  home_team_score: number;
  visitor_team_score: number;
};

type StatApi = {
  id: number;
  game: { id: number; date: string };
  player: { id: number };
  team?: { id: number };
  pts?: number;
  reb?: number;
  ast?: number;
  oreb?: number;
  dreb?: number;
  fgm?: number;
  fga?: number;
  fg?: number;
  fg3m?: number;
  fg3a?: number;
  fg3?: number;
  ftm?: number;
  fta?: number;
  ft?: number;
  stl?: number;
  blk?: number;
  turnover?: number;
  tov?: number;
  pf?: number;
  plus_minus?: number;
  min?: string;
};

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/json',
  };
  if (API_KEY) headers['Authorization'] = API_KEY;
  return headers;
}

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseMinutesToSeconds(min: string | undefined | null): number {
  if (!min) return 0;
  const parts = min.split(':').map(v => Number(v));
  if (parts.length === 1 && Number.isFinite(parts[0])) {
    return Math.max(0, Math.floor(parts[0] * 60));
  }
  if (parts.length !== 2 || parts.some(p => !Number.isFinite(p))) {
    return 0;
  }
  const [m, s] = parts;
  return Math.max(0, m * 60 + s);
}

export function getSeasonFallback(now: Date): number {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 10) return year + 1;
  return year;
}

export async function getSeasonForSync(db: DbAdapter, now: Date): Promise<number> {
  const since = subDays(startOfDay(now), 30);
  const recentSeason = await db.getMaxSeasonInRecentGames(since);
  if (recentSeason) return recentSeason;
  return getSeasonFallback(now);
}

export function getSeasonStartDate(season: number): Date {
  return new Date(`${season - 1}-10-01T00:00:00Z`);
}

async function getIncrementalRange(
  db: DbAdapter,
  season: number,
  now: Date
): Promise<{ startDate: Date; endDate: Date }> {
  const lastGameDate = await db.getLastGameDateForSeason(season);
  const seasonStart = getSeasonStartDate(season);
  const endDate = subDays(startOfDay(now), 1);

  if (!lastGameDate) {
    return { startDate: seasonStart, endDate };
  }

  const repairStart = subDays(startOfDay(lastGameDate), 3);
  const startDate = repairStart < seasonStart ? seasonStart : repairStart;
  return { startDate, endDate };
}

async function fetchAllGamesInRange(
  startDateStr: string,
  endDateStr: string,
  rateLimiter: ReturnType<typeof createTokenBucket>,
  maxRetries: number
): Promise<GameApi[]> {
  const allGames: GameApi[] = [];
  let cursor: number | null = null;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    let url = `${API_BASE}/nba/v1/games?start_date=${startDateStr}&end_date=${endDateStr}&per_page=100`;
    if (cursor != null) url += `&cursor=${cursor}`;

    const response = await fetchWithRetry(url, { headers: getHeaders() }, rateLimiter, maxRetries);
    if (!response.ok) {
      throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const pageData = Array.isArray(data?.data) ? data.data : [];
    allGames.push(...pageData);

    const nextCursor = data?.meta?.next_cursor ?? null;
    if (pageData.length > 0 && nextCursor != null) {
      cursor = nextCursor;
      page += 1;
    } else {
      hasMore = false;
    }
  }

  return allGames;
}

async function fetchAllStatsForGameIds(
  gameIds: number[],
  rateLimiter: ReturnType<typeof createTokenBucket>,
  maxRetries: number
): Promise<StatApi[]> {
  const allStats: StatApi[] = [];
  let cursor: number | null = null;
  let hasMore = true;

  while (hasMore) {
    const queryParams = gameIds.map(id => `game_ids[]=${id}`).join('&');
    let url = `${API_BASE}/nba/v1/stats?${queryParams}&per_page=100`;
    if (cursor != null) url += `&cursor=${cursor}`;

    const response = await fetchWithRetry(url, { headers: getHeaders() }, rateLimiter, maxRetries);
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const pageData = Array.isArray(data?.data) ? data.data : [];
    allStats.push(...pageData);

    const nextCursor = data?.meta?.next_cursor ?? null;
    if (pageData.length > 0 && nextCursor != null) {
      cursor = nextCursor;
    } else {
      hasMore = false;
    }
  }

  return allStats;
}

function mapGameToRow(game: GameApi): GameRow {
  return {
    id: game.id,
    date: new Date(game.date),
    season: game.season,
    status: game.status,
    homeTeamId: game.home_team.id,
    visitorTeamId: game.visitor_team.id,
    homeTeamScore: game.home_team_score,
    visitorTeamScore: game.visitor_team_score,
  };
}

function mapStatToRow(stat: StatApi, gameSeason: number | null): PlayerGameStatRow {
  return {
    id: stat.id,
    gameId: stat.game.id,
    season: gameSeason ?? getSeasonFallback(new Date(stat.game.date)),
    gameDate: new Date(stat.game.date),
    playerId: stat.player.id,
    teamId: stat.team?.id ?? 0,
    minutes: parseMinutesToSeconds(stat.min),
    pts: stat.pts ?? 0,
    reb: stat.reb ?? 0,
    ast: stat.ast ?? 0,
    oreb: stat.oreb ?? 0,
    dreb: stat.dreb ?? 0,
    fgm: stat.fgm ?? stat.fg ?? 0,
    fga: stat.fga ?? 0,
    fg3m: stat.fg3m ?? stat.fg3 ?? 0,
    fg3a: stat.fg3a ?? 0,
    ftm: stat.ftm ?? stat.ft ?? 0,
    fta: stat.fta ?? 0,
    stl: stat.stl ?? 0,
    blk: stat.blk ?? 0,
    turnover: stat.turnover ?? stat.tov ?? 0,
    pf: stat.pf ?? 0,
    plusMinus: stat.plus_minus ?? 0,
  };
}

function getBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function shouldFullRebuild(now: Date): boolean {
  return now.getUTCDay() === 0;
}

export async function runSeasonSync(options: SyncOptions) {
  const startTime = Date.now();
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxRetries = options.maxRetries ?? 5;
  const mode: SyncMode = options.mode ?? 'incremental';
  const dryRun = options.dryRun ?? false;

  const rateLimiter = createTokenBucket({
    capacity: RATE_LIMIT_PER_MIN,
    refillPerSecond: RATE_LIMIT_PER_MIN / 60,
    onWait: waitMs => logEvent('info', 'rate_limit_wait', { wait_ms: waitMs }),
  });

  const season = await getSeasonForSync(options.db, now);
  const { startDate, endDate } =
    mode === 'incremental'
      ? await getIncrementalRange(options.db, season, now)
      : {
          startDate: options.backfillStart ?? getSeasonStartDate(season),
          endDate: options.backfillEnd ?? subDays(startOfDay(now), 1),
        };

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  logEvent('info', 'sync_start', {
    mode,
    season,
    start_date: startDateStr,
    end_date: endDateStr,
    dry_run: dryRun,
  });

  if (startDate > endDate) {
    logEvent('info', 'sync_noop', { reason: 'start_after_end' });
    return { season, games: 0, stats: 0, players: 0, durationMs: 0 };
  }

  const games = await fetchAllGamesInRange(
    startDateStr,
    endDateStr,
    rateLimiter,
    maxRetries
  );
  const finalGames = games.filter(game => game.status === 'Final');
  const gameRows = finalGames.map(mapGameToRow);
  const gamesById = new Map<number, GameRow>();
  for (const game of gameRows) gamesById.set(game.id, game);

  if (!dryRun) {
    await options.db.upsertGames(gameRows);
  }

  const gameIds = gameRows.map(game => game.id);
  const gameIdBatches = getBatches(gameIds, batchSize);
  const affectedPlayerIds = new Set<number>();
  let totalStats = 0;

  for (let i = 0; i < gameIdBatches.length; i += 1) {
    const batch = gameIdBatches[i];
    if (batch.length === 0) continue;
    const stats = await fetchAllStatsForGameIds(batch, rateLimiter, maxRetries);
    totalStats += stats.length;
    const statRows: PlayerGameStatRow[] = stats.map(stat =>
      mapStatToRow(stat, gamesById.get(stat.game.id)?.season ?? null)
    );
    for (const row of statRows) affectedPlayerIds.add(row.playerId);
    if (!dryRun) {
      await options.db.upsertPlayerGameStats(statRows);
    }
  }

  let updatedPlayers = 0;
  if (!dryRun) {
    if (shouldFullRebuild(now)) {
      updatedPlayers = await options.db.rebuildSeasonTotals(season);
    } else {
      updatedPlayers = await options.db.updateSeasonTotalsForPlayers(
        season,
        Array.from(affectedPlayerIds)
      );
    }
  }

  const durationMs = Date.now() - startTime;
  logEvent('info', 'sync_complete', {
    mode,
    season,
    games: gameRows.length,
    stats: totalStats,
    updated_players: updatedPlayers,
    duration_ms: durationMs,
  });

  await options.db.upsertSyncState('last_sync', {
    mode,
    season,
    startDate: startDateStr,
    endDate: endDateStr,
    games: gameRows.length,
    stats: totalStats,
    updatedPlayers,
    durationMs,
    ranAt: new Date().toISOString(),
  });

  return {
    season,
    games: gameRows.length,
    stats: totalStats,
    players: updatedPlayers,
    durationMs,
  };
}
