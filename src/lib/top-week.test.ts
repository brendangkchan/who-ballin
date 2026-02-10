import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTopWeekPlayers, TopWeekError } from './top-week';

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => () => fn(),
}));

vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(() => ({})),
}));

const mockAdapter = {
  getCachedLeagueTotals: vi.fn(async () => null),
  getSeasonLeagueTotals: vi.fn(async () => null),
  setCachedLeagueTotals: vi.fn(async () => undefined),
  getSeasonTotalsForPlayers: vi.fn(async () => []),
  getPositionTsForSeason: vi.fn(async () => []),
  getSeasonTotalsWithPositions: vi.fn(async () => []),
  upsertPositionTs: vi.fn(async () => 0),
  getLastFinalGameDate: vi.fn(async () => new Date('2026-02-08T10:00:00Z')),
  getFinalGamesInRange: vi.fn(async () => []),
  getPlayerStatsInRange: vi.fn(async () => []),
};

vi.mock('@/lib/db/adapter', () => ({
  createDbAdapter: vi.fn(() => mockAdapter),
}));

vi.mock('@/lib/sync/seasonSync', () => ({
  getSeasonForSync: vi.fn(async () => 2025),
}));

import type { PlayerFilters } from '@/lib/filters';

function createGameRow(overrides: Partial<{
  id: number;
  date: Date;
  season: number;
  status: string;
  homeTeamId: number;
  visitorTeamId: number;
  homeTeamScore: number;
  visitorTeamScore: number;
}> = {}) {
  return {
    id: 1,
    date: new Date('2026-02-08T10:00:00Z'),
    season: 2025,
    status: 'Final',
    homeTeamId: 14, // LAL
    visitorTeamId: 2, // BOS
    homeTeamScore: 110,
    visitorTeamScore: 105,
    ...overrides,
  };
}

function createStatRow(overrides: Partial<{
  id: number;
  gameId: number;
  season: number;
  gameDate: Date;
  playerId: number;
  teamId: number;
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
  plusMinus: number | null;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
}> = {}) {
  return {
    id: 1,
    gameId: 1,
    season: 2025,
    gameDate: new Date('2026-02-08T10:00:00Z'),
    playerId: 100,
    teamId: 14,
    minutes: 2100,
    pts: 25,
    reb: 7,
    ast: 8,
    oreb: 1,
    dreb: 6,
    stl: 1,
    blk: 0,
    turnover: 2,
    pf: 2,
    fgm: 10,
    fga: 18,
    fg3m: 2,
    fg3a: 5,
    ftm: 4,
    fta: 5,
    plusMinus: 5,
    firstName: 'LeBron',
    lastName: 'James',
    position: 'F',
    ...overrides,
  };
}

describe('getTopWeekPlayers', () => {
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockAdapter.getCachedLeagueTotals.mockResolvedValue(null);
    mockAdapter.getSeasonLeagueTotals.mockResolvedValue(null);
    mockAdapter.setCachedLeagueTotals.mockResolvedValue(undefined);
    mockAdapter.getSeasonTotalsForPlayers.mockResolvedValue([]);
    mockAdapter.getLastFinalGameDate.mockResolvedValue(new Date('2026-02-08T10:00:00Z'));
    mockAdapter.getFinalGamesInRange.mockResolvedValue([]);
    mockAdapter.getPlayerStatsInRange.mockResolvedValue([]);
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
  });

  it('returns empty players when no games', async () => {
    const filters: PlayerFilters = { minGames: 2, minPts: 20, minMinutes: 40 };
    const data = await getTopWeekPlayers(filters);
    expect(data.players).toEqual([]);
    expect(data.generatedAt).toBeDefined();
    expect(typeof data.generatedAt).toBe('string');
    expect(Number.isNaN(new Date(data.generatedAt ?? '').getTime())).toBe(false);
  });

  it('includes filter settings in debug warnings', async () => {
    const filters: PlayerFilters = { minGames: 5, minPts: 30, minMinutes: 60 };
    const data = await getTopWeekPlayers(filters);
    expect(data.debug?.warnings).toBeDefined();
    const filterMsg = data.debug?.warnings?.find((w: string) => w.startsWith('Filters:'));
    expect(filterMsg).toContain('minGames=5');
    expect(filterMsg).toContain('minPts=30');
    expect(filterMsg).toContain('minMinutes=60');
  });

  it('returns players when games and stats exist', async () => {
    const gameRow = createGameRow();
    const statRow = createStatRow();

    mockAdapter.getFinalGamesInRange.mockResolvedValue([gameRow]);
    mockAdapter.getPlayerStatsInRange.mockResolvedValue([statRow]);

    const filters: PlayerFilters = { minGames: 1, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(1);
    expect(data.players[0].player.first_name).toBe('LeBron');
    expect(data.players[0].games).toBe(1);
    expect(data.players[0].totalPts).toBe(25);
    expect(data.players[0].gameResults).toHaveLength(1);
    expect(data.players[0].gameResults[0].result).toBe('W');
    expect(data.players[0].gameResults[0].opponent.name).toBe('Boston Celtics');
    expect(data.generatedAt).toBeDefined();
  });

  it('sets adjusted PER when league totals are available', async () => {
    const gameRow = createGameRow();
    const statRow = createStatRow();

    mockAdapter.getFinalGamesInRange.mockResolvedValue([gameRow]);
    mockAdapter.getPlayerStatsInRange.mockResolvedValue([statRow]);
    mockAdapter.getSeasonLeagueTotals.mockResolvedValue({
      minutes: 10000,
      pts: 10000,
      reb: 4000,
      ast: 2500,
      oreb: 1200,
      dreb: 2800,
      stl: 800,
      blk: 500,
      turnover: 1200,
      pf: 1500,
      fgm: 3800,
      fga: 8000,
      fg3m: 900,
      fg3a: 2600,
      ftm: 1500,
      fta: 2000,
    });

    const filters: PlayerFilters = { minGames: 1, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(1);
    expect(typeof data.players[0].perAdjusted).toBe('number');
  });

  it('uses fallback date range when last game is older than 1 day', async () => {
    const now = new Date('2026-02-09T10:00:00Z');
    const lastGame = new Date('2026-02-07T10:00:00Z');
    mockAdapter.getLastFinalGameDate.mockResolvedValue(lastGame);
    mockAdapter.getFinalGamesInRange.mockResolvedValue([createGameRow({ date: lastGame })]);
    mockAdapter.getPlayerStatsInRange.mockResolvedValue([createStatRow({ gameDate: lastGame })]);

    const filters: PlayerFilters = { minGames: 1, minPts: 1, minMinutes: 1 };
    const originalDateNow = Date.now;
    Date.now = () => now.getTime();
    const data = await getTopWeekPlayers(filters);
    Date.now = originalDateNow;

    expect(data.debug?.dateRange.usedFallback).toBe(true);
    expect(data.players).toHaveLength(1);
  });

  it('excludes players who lost more than half their games', async () => {
    const game1 = createGameRow({ id: 1, homeTeamId: 14, visitorTeamId: 2, homeTeamScore: 90, visitorTeamScore: 100 });
    const game2 = createGameRow({ id: 2, homeTeamId: 14, visitorTeamId: 2, homeTeamScore: 85, visitorTeamScore: 95 });
    const stat1 = createStatRow({ id: 1, gameId: 1, pts: 20, plusMinus: -10 });
    const stat2 = createStatRow({ id: 2, gameId: 2, pts: 22, plusMinus: -10 });

    mockAdapter.getFinalGamesInRange.mockResolvedValue([game1, game2]);
    mockAdapter.getPlayerStatsInRange.mockResolvedValue([stat1, stat2]);

    const filters: PlayerFilters = { minGames: 2, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(0);
  });

  it('excludes players with negative +/- unless they won all games', async () => {
    const game1 = createGameRow({ id: 1, homeTeamScore: 100, visitorTeamScore: 90 });
    const game2 = createGameRow({ id: 2, homeTeamScore: 85, visitorTeamScore: 95 });
    const stat1 = createStatRow({ id: 1, gameId: 1, pts: 25, plusMinus: 10 });
    const stat2 = createStatRow({ id: 2, gameId: 2, pts: 20, plusMinus: -15 });

    mockAdapter.getFinalGamesInRange.mockResolvedValue([game1, game2]);
    mockAdapter.getPlayerStatsInRange.mockResolvedValue([stat1, stat2]);

    const filters: PlayerFilters = { minGames: 2, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(0);
  });

  it('handles missing player metadata without error', async () => {
    const gameRow = createGameRow();
    const statRow = createStatRow({ firstName: null, lastName: null, position: null });

    mockAdapter.getFinalGamesInRange.mockResolvedValue([gameRow]);
    mockAdapter.getPlayerStatsInRange.mockResolvedValue([statRow]);

    const filters: PlayerFilters = { minGames: 1, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(1);
    expect(data.players[0].player.first_name).toBe('N/A');
  });

  it('handles missing team metadata without error', async () => {
    const gameRow = createGameRow({ homeTeamId: 999, visitorTeamId: 998 });
    const statRow = createStatRow({ teamId: 999 });

    mockAdapter.getFinalGamesInRange.mockResolvedValue([gameRow]);
    mockAdapter.getPlayerStatsInRange.mockResolvedValue([statRow]);

    const filters: PlayerFilters = { minGames: 1, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(1);
    expect(data.players[0].gameResults[0].opponent.name).toBe('N/A');
  });

  it('converts minutes from seconds to MM:SS', async () => {
    const gameRow = createGameRow();
    const statRow = createStatRow({ minutes: 90 });

    mockAdapter.getFinalGamesInRange.mockResolvedValue([gameRow]);
    mockAdapter.getPlayerStatsInRange.mockResolvedValue([statRow]);

    const filters: PlayerFilters = { minGames: 1, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(1);
    expect(data.players[0].totalMinutes).toBeCloseTo(1.5, 3);
  });

  it('throws TopWeekError when upstream fetch fails', async () => {
    mockAdapter.getFinalGamesInRange.mockRejectedValue(new Error('DB error'));

    const filters: PlayerFilters = { minGames: 2, minPts: 20, minMinutes: 40 };

    await expect(getTopWeekPlayers(filters)).rejects.toBeInstanceOf(TopWeekError);

    try {
      await getTopWeekPlayers(filters);
    } catch (error: any) {
      expect(error).toBeInstanceOf(TopWeekError);
      expect(error.debug?.errors.some((e: string) => e.includes('DB error'))).toBe(true);
    }
  });
});
