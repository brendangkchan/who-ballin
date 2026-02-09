import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getTopWeekPlayers, TopWeekError } from '@/lib/top-week';
import type { DebugInfo } from '@/types/player';

vi.mock('@/lib/top-week', async () => {
  const actual = await vi.importActual<typeof import('@/lib/top-week')>('@/lib/top-week');
  return {
    ...actual,
    getTopWeekPlayers: vi.fn(),
  };
});

function createRequest(url = 'http://localhost/api/players/top-week'): NextRequest {
  return new NextRequest(url);
}

describe('GET /api/players/top-week', () => {
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
  });

  it('calls getTopWeekPlayers with parsed filters and returns data', async () => {
    const mockResult = {
      players: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(getTopWeekPlayers).mockResolvedValue(mockResult as any);

    const req = createRequest(
      'http://localhost/api/players/top-week?minGames=5&minPts=30&minMinutes=60'
    );
    const res = await GET(req);
    const data = await res.json();

    expect(vi.mocked(getTopWeekPlayers)).toHaveBeenCalledWith({
      minGames: 5,
      minPts: 30,
      minMinutes: 60,
    });
    expect(res.status).toBe(200);
    expect(data).toEqual(mockResult);
  });

  it('returns 500 with debug info when TopWeekError is thrown in development', async () => {
    process.env.NODE_ENV = 'development';

    const debugInfo: DebugInfo = {
      requests: 0,
      errors: ['boom'],
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

    vi.mocked(getTopWeekPlayers).mockRejectedValue(
      new TopWeekError('boom', debugInfo, 'stack')
    );

    const req = createRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to fetch top players');
    expect(data.debug?.errors).toContain('boom');
    expect(data.stack).toBeDefined();
  });
});
