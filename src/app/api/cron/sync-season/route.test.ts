import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const mockRevalidateTag = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock('@/lib/db/adapter', () => ({
  createDbAdapter: vi.fn(() => ({})),
}));

vi.mock('@/lib/sync/seasonSync', () => ({
  runSeasonSync: vi.fn(),
}));

vi.mock('@/lib/sync/logger', () => ({
  logEvent: vi.fn(),
}));

import { runSeasonSync } from '@/lib/sync/seasonSync';
import { logEvent } from '@/lib/sync/logger';

function createRequest(options: { headers?: Record<string, string>; url?: string } = {}) {
  const url = options.url ?? 'http://localhost/api/cron/sync-season';
  return new NextRequest(url, { headers: options.headers });
}

describe('GET /api/cron/sync-season', () => {
  const origSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.CRON_SECRET = origSecret;
  });

  it('runs sync and revalidates caches when authorized', async () => {
    delete process.env.CRON_SECRET;
    vi.mocked(runSeasonSync).mockResolvedValue({
      season: 2025,
      games: 0,
      stats: 0,
      players: 0,
      durationMs: 0,
    } as any);

    const req = createRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(vi.mocked(runSeasonSync)).toHaveBeenCalled();
    expect(mockRevalidateTag).toHaveBeenCalledWith('top-week', 'max');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/by-position');
  });

  it('returns 401 when secret is set and auth is missing/invalid', async () => {
    process.env.CRON_SECRET = 'secret';

    const req = createRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(vi.mocked(runSeasonSync)).not.toHaveBeenCalled();
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 500 when sync throws and logs error', async () => {
    delete process.env.CRON_SECRET;
    vi.mocked(runSeasonSync).mockRejectedValue(new Error('sync failed'));

    const req = createRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(vi.mocked(logEvent)).toHaveBeenCalled();
  });
});
