import { config } from 'dotenv';
import { createDbAdapter } from '../src/lib/db/adapter';
import { getDb } from '../src/lib/db/client';
import { getSeasonForSync } from '../src/lib/sync/seasonSync';

config({ path: '.env.local' });

const DEBUG = true;

function debugLog(message: string, meta?: Record<string, unknown>) {
  if (!DEBUG) return;
  if (meta) {
    console.debug(`[check-position-ts] ${message}`, meta);
  } else {
    console.debug(`[check-position-ts] ${message}`);
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
  debugLog('start', { season });

  const rows = await adapter.getPositionTsForSeason(season);
  debugLog('rows_loaded', { count: rows.length });

  if (rows.length === 0) {
    console.log(`[check-position-ts] no rows for season ${season}`);
    return;
  }

  const byGroup = new Map(rows.map(row => [row.positionGroup, row]));
  const guard = byGroup.get('guard');
  const wing = byGroup.get('wing');
  const big = byGroup.get('big');

  console.log(
    `[check-position-ts] season=${season} cutoff=${guard?.attemptCutoff ?? wing?.attemptCutoff ?? big?.attemptCutoff ?? '—'} ` +
    `guard=${guard?.avgTs?.toFixed(1) ?? '—'}% (${guard?.playerCount ?? 0}) ` +
    `wing=${wing?.avgTs?.toFixed(1) ?? '—'}% (${wing?.playerCount ?? 0}) ` +
    `big=${big?.avgTs?.toFixed(1) ?? '—'}% (${big?.playerCount ?? 0})`
  );
}

main().catch(error => {
  console.error('[check-position-ts] failed:', error?.message ?? error);
  process.exit(1);
});
