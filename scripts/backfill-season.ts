import { config } from 'dotenv';
import { createDbAdapter } from '../src/lib/db/adapter';
import { getDb } from '../src/lib/db/client';
import { getSeasonForSync, getSeasonStartDate, runSeasonSync } from '../src/lib/sync/seasonSync';
import { logEvent } from '../src/lib/sync/logger';
import { addDays, endOfDay, startOfDay, subDays } from 'date-fns';

config({ path: '.env.local' });

function parseArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const CHUNK_DAYS = Number(process.env.BACKFILL_CHUNK_DAYS ?? '7');

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
  const startArg = parseDate(parseArg('--start'));
  const endArg = parseDate(parseArg('--end'));

  const adapter = createDbAdapter(getDb());
  const now = new Date();
  const season = await getSeasonForSync(adapter, now);

  const state = (await adapter.getSyncState('backfill_state')) as
    | { nextStart?: string; season?: number }
    | null;

  const seasonStart = getSeasonStartDate(season);
  const startDate = startArg ?? (state?.nextStart ? new Date(state.nextStart) : seasonStart);
  const endDate = endArg ?? subDays(startOfDay(now), 1);

  logEvent('info', 'backfill_start', {
    season,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    chunk_days: CHUNK_DAYS,
    dry_run: dryRun,
  });

  let cursor = startOfDay(startDate);
  const finalEnd = endOfDay(endDate);

  while (cursor <= finalEnd) {
    const chunkStart = cursor;
    const chunkEnd = addDays(chunkStart, CHUNK_DAYS - 1);
    const boundedEnd = chunkEnd > finalEnd ? finalEnd : chunkEnd;

    await runSeasonSync({
      db: adapter,
      mode: 'backfill',
      backfillStart: chunkStart,
      backfillEnd: boundedEnd,
      dryRun,
      now,
    });

    const nextStart = addDays(boundedEnd, 1);
    await adapter.upsertSyncState('backfill_state', {
      season,
      nextStart: nextStart.toISOString(),
      updatedAt: new Date().toISOString(),
    });

    cursor = nextStart;
  }

  logEvent('info', 'backfill_complete', {
    season,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  });
}

main().catch(error => {
  logEvent('error', 'backfill_failed', { message: error?.message ?? String(error) });
  process.exit(1);
});
