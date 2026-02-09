import { config } from 'dotenv';
import { getDb } from '../src/lib/db/client';
import { createDbAdapter } from '../src/lib/db/adapter';
import { getSeasonForSync } from '../src/lib/sync/seasonSync';
import { buildTeamSeasonStats } from '../src/lib/team-season-stats';

config({ path: '.env.local' });

async function main() {
  const db = getDb();
  const adapter = createDbAdapter(db);
  const now = new Date();
  const season = await getSeasonForSync(adapter, now);
  const games = await adapter.getGamesForSeason(season);

  if (games.length === 0) {
    console.log(`No games found for season ${season}`);
    return;
  }

  const rows = buildTeamSeasonStats(season, games, { now });
  const upserted = await adapter.upsertTeamSeasonStats(rows);

  console.log(`Backfilled team_season_stats for season ${season}: ${upserted} rows`);
}

main().catch(error => {
  console.error('backfill-team-season-stats failed:', error?.message ?? error);
  process.exit(1);
});
