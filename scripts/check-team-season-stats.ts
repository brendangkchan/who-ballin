import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { getDb } from '../src/lib/db/client';

config({ path: '.env.local' });

async function main() {
  const db = getDb();
  const url = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? '';
  if (url) {
    try {
      const parsed = new URL(url);
      const port = parsed.port ? `:${parsed.port}` : '';
      console.log(`db_url_host=***${port}`);
      const dbName = parsed.pathname.replace('/', '');
      if (dbName) {
        console.log(`db_name=${dbName}`);
      }
    } catch {
      console.log('db_url_host=invalid');
    }
  } else {
    console.log('db_url_host=missing');
  }

  try {
    await db.execute(sql`select 1 as ok`);
  } catch (error: any) {
    console.error('db_ping_failed:', error?.message ?? error);
    if (error?.cause?.message) {
      console.error('db_ping_cause:', error.cause.message);
    }
    return;
  }

  let tableCheck: any;
  try {
    tableCheck = await db.execute(sql`
      select count(*)::int as count
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'team_season_stats'
    `);
  } catch (error: any) {
    console.error('table_check_failed:', error?.message ?? error);
    if (error?.cause?.message) {
      console.error('table_check_cause:', error.cause.message);
    }
    return;
  }
  const tableCount = (tableCheck as any).rows?.[0]?.count ?? 0;
  if (tableCount === 0) {
    console.log('team_season_stats: table not found in this database');
    return;
  }

  const result = await db.execute(sql`
    select
      season,
      conference,
      count(*)::int as teams,
      min(updated_at) as min_updated_at,
      max(updated_at) as max_updated_at
    from team_season_stats
    group by season, conference
    order by season desc, conference asc
  `);

  const rows = (result as any).rows ?? [];
  if (rows.length === 0) {
    console.log('team_season_stats: empty');
    return;
  }

  console.log('team_season_stats summary:');
  for (const row of rows) {
    console.log(
      `season=${row.season} conference=${row.conference} teams=${row.teams} updated_at=${row.min_updated_at}..${row.max_updated_at}`
    );
  }
}

main().catch(error => {
  console.error('check-team-season-stats failed:', error?.message ?? error);
  process.exit(1);
});
