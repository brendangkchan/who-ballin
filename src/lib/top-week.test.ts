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
};

vi.mock('@/lib/db/adapter', () => ({
  createDbAdapter: vi.fn(() => mockAdapter),
}));

vi.mock('@/lib/sync/seasonSync', () => ({
  getSeasonForSync: vi.fn(async () => 2025),
}));

vi.mock('@/lib/balldontlie', () => ({
  getAllGames: vi.fn(),
  getLastCompletedGame: vi.fn(),
  getAllStatsForGames: vi.fn(),
  getCurrentNBASeason: vi.fn(() => 2025),
}));

import { getAllGames, getLastCompletedGame, getAllStatsForGames } from '@/lib/balldontlie';
import type { Game, GameStats } from '@/types/player';
import type { PlayerFilters } from '@/lib/filters';

function createGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    date: '2026-01-15',
    season: 2025,
    status: 'Final',
    home_team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
    visitor_team: { id: 2, abbreviation: 'BOS', city: 'Boston', name: 'Celtics' },
    home_team_score: 110,
    visitor_team_score: 105,
    ...overrides,
  };
}

function createGameStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    id: 1,
    game: { id: 1, date: '2026-01-15' },
    player: { id: 100, first_name: 'LeBron', last_name: 'James' },
    team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
    pts: 25,
    reb: 7,
    ast: 8,
    fg: 10,
    fga: 18,
    ft: 4,
    fta: 5,
    min: '35:00',
    plus_minus: 5,
    ...overrides,
  };
}

describe('getTopWeekPlayers', () => {
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.mocked(getAllGames).mockResolvedValue([]);
    vi.mocked(getLastCompletedGame).mockResolvedValue(null);
    vi.mocked(getAllStatsForGames).mockResolvedValue([]);
    mockAdapter.getCachedLeagueTotals.mockResolvedValue(null);
    mockAdapter.getSeasonLeagueTotals.mockResolvedValue(null);
    mockAdapter.setCachedLeagueTotals.mockResolvedValue(undefined);
    mockAdapter.getSeasonTotalsForPlayers.mockResolvedValue([]);
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
    const game = createGame({ id: 1, home_team_score: 110, visitor_team_score: 105 });
    const stat = createGameStats({
      game: { id: 1, date: '2026-01-15' },
      player: { id: 100, first_name: 'LeBron', last_name: 'James' },
      team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
      pts: 25,
      min: '35:00',
      plus_minus: 5,
    });

    vi.mocked(getAllGames).mockResolvedValue([game]);
    vi.mocked(getAllStatsForGames).mockResolvedValue([stat]);

    const filters: PlayerFilters = { minGames: 1, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(1);
    expect(data.players[0].player.first_name).toBe('LeBron');
    expect(data.players[0].games).toBe(1);
    expect(data.players[0].totalPts).toBe(25);
    expect(data.players[0].gameResults).toHaveLength(1);
    expect(data.players[0].gameResults[0].result).toBe('W');
    expect(data.players[0].gameResults[0].opponent.name).toBe('Celtics');
    expect(data.generatedAt).toBeDefined();
  });

  it('sets adjusted PER when league totals are available', async () => {
    const game = createGame({ id: 1, home_team_score: 110, visitor_team_score: 105 });
    const stat = createGameStats({
      game: { id: 1, date: '2026-01-15' },
      player: { id: 100, first_name: 'LeBron', last_name: 'James' },
      team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
      pts: 25,
      min: '35:00',
      plus_minus: 5,
    });

    vi.mocked(getAllGames).mockResolvedValue([game]);
    vi.mocked(getAllStatsForGames).mockResolvedValue([stat]);
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

  it('uses fallback date range when no games in primary range', async () => {
    const now = new Date();
    const recentFallback = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentDate = recentFallback.toISOString().slice(0, 10);
    const fallbackGame = createGame({ id: 1, date: recentDate });
    const stat = createGameStats({
      game: { id: 1, date: recentDate },
      player: { id: 100, first_name: 'LeBron', last_name: 'James' },
      team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
      pts: 25,
      min: '35:00',
      plus_minus: 5,
    });

    vi.mocked(getAllGames)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([fallbackGame])
      .mockResolvedValue([fallbackGame]);
    vi.mocked(getLastCompletedGame).mockResolvedValue({ date: recentDate });
    vi.mocked(getAllStatsForGames).mockResolvedValue([stat]);

    const filters: PlayerFilters = { minGames: 1, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.debug?.dateRange.usedFallback).toBe(true);
    expect(data.players).toHaveLength(1);
  });

  it('excludes players who lost more than half their games', async () => {
    const game1 = createGame({ id: 1, home_team_score: 90, visitor_team_score: 100 });
    const game2 = createGame({ id: 2, home_team_score: 85, visitor_team_score: 95 });
    const stat1 = createGameStats({
      id: 1,
      game: { id: 1, date: '2026-01-15' },
      player: { id: 100, first_name: 'Player', last_name: 'A' },
      team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
      pts: 20,
      min: '30:00',
      plus_minus: -10,
    });
    const stat2 = createGameStats({
      id: 2,
      game: { id: 2, date: '2026-01-16' },
      player: { id: 100, first_name: 'Player', last_name: 'A' },
      team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
      pts: 22,
      min: '32:00',
      plus_minus: -10,
    });

    vi.mocked(getAllGames).mockResolvedValue([game1, game2]);
    vi.mocked(getAllStatsForGames).mockResolvedValue([stat1, stat2]);

    const filters: PlayerFilters = { minGames: 2, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(0);
  });

  it('excludes players with negative +/- unless they won all games', async () => {
    const game1 = createGame({ id: 1, home_team_score: 100, visitor_team_score: 90 });
    const game2 = createGame({ id: 2, home_team_score: 85, visitor_team_score: 95 });
    const stat1 = createGameStats({
      id: 1,
      game: { id: 1, date: '2026-01-15' },
      player: { id: 100, first_name: 'Player', last_name: 'A' },
      team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
      pts: 25,
      min: '35:00',
      plus_minus: 10,
    });
    const stat2 = createGameStats({
      id: 2,
      game: { id: 2, date: '2026-01-16' },
      player: { id: 100, first_name: 'Player', last_name: 'A' },
      team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
      pts: 20,
      min: '30:00',
      plus_minus: -15,
    });

    vi.mocked(getAllGames).mockResolvedValue([game1, game2]);
    vi.mocked(getAllStatsForGames).mockResolvedValue([stat1, stat2]);

    const filters: PlayerFilters = { minGames: 2, minPts: 1, minMinutes: 1 };
    const data = await getTopWeekPlayers(filters);

    expect(data.players).toHaveLength(0);
  });

  it('throws TopWeekError when upstream fetch fails', async () => {
    vi.mocked(getAllGames).mockRejectedValue(new Error('API error'));

    const filters: PlayerFilters = { minGames: 2, minPts: 20, minMinutes: 40 };

    await expect(getTopWeekPlayers(filters)).rejects.toBeInstanceOf(TopWeekError);

    try {
      await getTopWeekPlayers(filters);
    } catch (error: any) {
      expect(error).toBeInstanceOf(TopWeekError);
      expect(error.debug?.errors.some((e: string) => e.includes('API error'))).toBe(true);
    }
  });
});
