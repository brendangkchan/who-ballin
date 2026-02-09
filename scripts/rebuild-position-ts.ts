import { config } from 'dotenv';
import { createDbAdapter } from '../src/lib/db/adapter';
import { getDb } from '../src/lib/db/client';
import { getSeasonForSync } from '../src/lib/sync/seasonSync';
import { computePositionTsSummary, POSITION_TS_ATTEMPT_CUTOFF } from '../src/lib/position-ts';

config({ path: '.env.local' });

const DEBUG = true;

function debugLog(message: string, meta?: Record<string, unknown>) {
  if (!DEBUG) return;
  if (meta) {
    console.debug(`[rebuild-position-ts] ${message}`, meta);
  } else {
    console.debug(`[rebuild-position-ts] ${message}`);
  }
}

function parseSeasonArg(): number | null {
  const idx = process.argv.indexOf('--season');
  if (idx === -1) return null;
  const val = Number(process.argv[idx + 1]);
  return Number.isFinite(val) ? val : null;
}

async function main() {
  const adapter = createDbAdapter(getDb());
  const now = new Date();
  const season = parseSeasonArg() ?? (await getSeasonForSync(adapter, now));
  debugLog('start', { season, cutoff: POSITION_TS_ATTEMPT_CUTOFF });

  const rows = await adapter.getSeasonTotalsWithPositions(season);
  debugLog('rows_loaded', { count: rows.length });
  const summary = computePositionTsSummary(rows, POSITION_TS_ATTEMPT_CUTOFF);
  debugLog('summary_computed', {
    guard: summary.averages.guard,
    wing: summary.averages.forward,
    big: summary.averages.center,
    counts: summary.counts,
  });

  await adapter.upsertPositionTs([
    {
      season,
      positionGroup: 'guard',
      attemptCutoff: POSITION_TS_ATTEMPT_CUTOFF,
      avgTs: summary.averages.guard ?? null,
      playerCount: summary.counts.guard,
      updatedAt: new Date(),
    },
    {
      season,
      positionGroup: 'wing',
      attemptCutoff: POSITION_TS_ATTEMPT_CUTOFF,
      avgTs: summary.averages.forward ?? null,
      playerCount: summary.counts.forward,
      updatedAt: new Date(),
    },
    {
      season,
      positionGroup: 'big',
      attemptCutoff: POSITION_TS_ATTEMPT_CUTOFF,
      avgTs: summary.averages.center ?? null,
      playerCount: summary.counts.center,
      updatedAt: new Date(),
    },
  ]);
  debugLog('upsert_complete');

  console.log(
    `[rebuild-position-ts] season=${season} cutoff=${POSITION_TS_ATTEMPT_CUTOFF} ` +
    `guard=${summary.averages.guard?.toFixed(1) ?? '—'}% (${summary.counts.guard}) ` +
    `wing=${summary.averages.forward?.toFixed(1) ?? '—'}% (${summary.counts.forward}) ` +
    `big=${summary.averages.center?.toFixed(1) ?? '—'}% (${summary.counts.center})`
  );
}

main().catch(error => {
  console.error('[rebuild-position-ts] failed:', error?.message ?? error);
  process.exit(1);
});
