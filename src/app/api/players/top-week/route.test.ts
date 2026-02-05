import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

vi.mock('@/lib/balldontlie', () => ({
  getAllGames: vi.fn(),
  getLastCompletedGame: vi.fn(),
  getStatsForGames: vi.fn(),
  getCurrentNBASeason: vi.fn(() => '2024-25'),
}));

import { getAllGames, getLastCompletedGame } from '@/lib/balldontlie';

function createRequest(url = 'http://localhost/api/players/top-week'): NextRequest {
  return new NextRequest(url);
}

describe('GET /api/players/top-week', () => {
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.mocked(getAllGames).mockResolvedValue([]);
    vi.mocked(getLastCompletedGame).mockResolvedValue(null);
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
  });

  it('returns 200 with empty players when no games', async () => {
    const req = createRequest();
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.players).toEqual([]);
  });

  it('parses filter query params and includes them in debug', async () => {
    const req = createRequest(
      'http://localhost/api/players/top-week?minGames=5&minPts=30&minMinutes=60'
    );
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.debug?.warnings).toBeDefined();
    const filterMsg = data.debug.warnings.find((w: string) =>
      w.startsWith('Filters:')
    );
    expect(filterMsg).toContain('minGames=5');
    expect(filterMsg).toContain('minPts=30');
    expect(filterMsg).toContain('minMinutes=60');
  });

  it('uses default filters when query params are missing', async () => {
    const req = createRequest('http://localhost/api/players/top-week');
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    const filterMsg = data.debug?.warnings?.find((w: string) =>
      w.startsWith('Filters:')
    );
    expect(filterMsg).toContain('minGames=2');
    expect(filterMsg).toContain('minPts=20');
    expect(filterMsg).toContain('minMinutes=40');
  });
});
