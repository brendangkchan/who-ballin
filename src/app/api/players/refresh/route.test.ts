import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const mockRevalidateTag = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

function createRequest(options: {
  method?: string;
  headers?: Record<string, string>;
  url?: string;
} = {}): NextRequest {
  const url = options.url ?? 'http://localhost/api/players/refresh';
  return new NextRequest(url, {
    method: options.method ?? 'POST',
    headers: options.headers,
  });
}

describe('POST /api/players/refresh', () => {
  const origSecret = process.env.REVALIDATE_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.REVALIDATE_SECRET = origSecret;
  });

  it('returns 200 and calls revalidation when no REVALIDATE_SECRET is set', async () => {
    delete process.env.REVALIDATE_SECRET;

    const req = createRequest();
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.timestamp).toBeDefined();
    expect(mockRevalidateTag).toHaveBeenCalledWith('top-week', 'max');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/api/players/top-week');
  });

  it('returns 401 when secret is set and no auth provided', async () => {
    process.env.REVALIDATE_SECRET = 'my-secret';

    const req = createRequest();
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockRevalidateTag).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns 401 when secret is set and wrong secret in Bearer', async () => {
    process.env.REVALIDATE_SECRET = 'my-secret';

    const req = createRequest({
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 200 when secret matches via Bearer token', async () => {
    process.env.REVALIDATE_SECRET = 'my-secret';

    const req = createRequest({
      headers: { Authorization: 'Bearer my-secret' },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRevalidateTag).toHaveBeenCalledWith('top-week', 'max');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/api/players/top-week');
  });

  it('returns 200 when secret matches via query param', async () => {
    process.env.REVALIDATE_SECRET = 'my-secret';

    const req = createRequest({
      url: 'http://localhost/api/players/refresh?secret=my-secret',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRevalidateTag).toHaveBeenCalledWith('top-week', 'max');
  });
});
