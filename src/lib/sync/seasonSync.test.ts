import { describe, expect, it, vi } from 'vitest';
import { parseMinutesToSeconds, getSeasonFallback, runSeasonSync } from './seasonSync';
import type { DbAdapter } from '@/lib/db/adapter';

describe('parseMinutesToSeconds', () => {
  it('parses MM:SS correctly', () => {
    expect(parseMinutesToSeconds('12:34')).toBe(12 * 60 + 34);
  });

  it('parses minutes only', () => {
    expect(parseMinutesToSeconds('18')).toBe(18 * 60);
  });

  it('handles invalid input', () => {
    expect(parseMinutesToSeconds('bad')).toBe(0);
    expect(parseMinutesToSeconds('12:xx')).toBe(0);
    expect(parseMinutesToSeconds(undefined)).toBe(0);
  });
});

describe('getSeasonFallback', () => {
  it('returns next year for Oct-Dec', () => {
    const date = new Date('2025-10-15T00:00:00Z');
    expect(getSeasonFallback(date)).toBe(2026);
  });

  it('returns current year for Jan-Jun', () => {
    const date = new Date('2026-02-01T00:00:00Z');
    expect(getSeasonFallback(date)).toBe(2026);
  });
});

describe('runSeasonSync', () => {
  it('runs with mocked db and fetch', async () => {
    const mockDb: DbAdapter = {
      upsertGames: vi.fn(async () => 1),
      upsertPlayerGameStats: vi.fn(async () => 1),
      getMaxSeasonInRecentGames: vi.fn(async () => 2026),
      getLastGameDateForSeason: vi.fn(async () => null),
      updateSeasonTotalsForPlayers: vi.fn(async () => 0),
      rebuildSeasonTotals: vi.fn(async () => 0),
      getSyncState: vi.fn(async () => null),
      upsertSyncState: vi.fn(async () => undefined),
    };

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/games?')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 1,
                date: '2026-02-05T00:00:00Z',
                season: 2026,
                status: 'Final',
                home_team: { id: 10 },
                visitor_team: { id: 20 },
                home_team_score: 110,
                visitor_team_score: 100,
              },
            ],
            meta: { next_cursor: null },
          }),
          { status: 200 }
        );
      }
      if (url.includes('/stats?')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 99,
                game: { id: 1, date: '2026-02-05T00:00:00Z' },
                player: { id: 5 },
                team: { id: 10 },
                pts: 25,
                reb: 8,
                ast: 6,
                min: '32:10',
              },
            ],
            meta: { next_cursor: null },
          }),
          { status: 200 }
        );
      }
      throw new Error(`unexpected url ${url}`);
    });

    const originalFetch = globalThis.fetch;
    // @ts-expect-error - mock
    globalThis.fetch = fetchMock;

    const result = await runSeasonSync({
      db: mockDb,
      dryRun: true,
      now: new Date('2026-02-07T08:00:00Z'),
    });

    globalThis.fetch = originalFetch;

    expect(result.games).toBe(1);
    expect(result.stats).toBe(1);
    expect(mockDb.upsertSyncState).toHaveBeenCalled();
  });
});
