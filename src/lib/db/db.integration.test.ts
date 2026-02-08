import { describe, expect, it } from 'vitest';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

const integrationUrl = process.env.INTEGRATION_DATABASE_URL;
const testIt = integrationUrl ? it : it.skip;

describe('db integration', () => {
  testIt('connects and finds core tables', async () => {
    const client = neon(integrationUrl!);
    const db = drizzle({ client });

    const result = await db.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('games', 'player_game_stats', 'player_season_totals', 'sync_state')
    `);

    const names = new Set(result.rows.map((row: any) => row.table_name));
    expect(names.has('games')).toBe(true);
    expect(names.has('player_game_stats')).toBe(true);
    expect(names.has('player_season_totals')).toBe(true);
    expect(names.has('sync_state')).toBe(true);
  });
});
