import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { getDb } from '../src/lib/db/client';

config({ path: '.env.local' });

async function main() {
  const db = getDb();
  const gamesResult = await db.execute(
    sql`select count(*)::int as count from games`
  );
  const statsResult = await db.execute(
    sql`select count(*)::int as count from player_game_stats`
  );
  const totalsResult = await db.execute(
    sql`select count(*)::int as count from player_season_totals`
  );
  const recentResult = await db.execute(
    sql`select max(date) as max_date from games`
  );

  const gamesCount = (gamesResult as any).rows?.[0]?.count ?? 0;
  const statsCount = (statsResult as any).rows?.[0]?.count ?? 0;
  const totalsCount = (totalsResult as any).rows?.[0]?.count ?? 0;
  const recentGame = (recentResult as any).rows?.[0]?.max_date ?? null;

  console.log('games:', gamesCount);
  console.log('player_game_stats:', statsCount);
  console.log('player_season_totals:', totalsCount);
  console.log('most_recent_game:', recentGame);
}

main().catch(error => {
  console.error('check-db failed:', error?.message ?? error);
  process.exit(1);
});
