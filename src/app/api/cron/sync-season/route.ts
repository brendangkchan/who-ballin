import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { createDbAdapter } from '@/lib/db/adapter';
import { runSeasonSync } from '@/lib/sync/seasonSync';
import { logEvent } from '@/lib/sync/logger';

export const runtime = 'nodejs';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adapter = createDbAdapter(getDb());
    const result = await runSeasonSync({ db: adapter });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    logEvent('error', 'cron_sync_failed', {
      message: error?.message ?? 'unknown error',
    });
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'unknown error' },
      { status: 500 }
    );
  }
}
