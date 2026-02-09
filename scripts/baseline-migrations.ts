import { config } from 'dotenv';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { sql } from 'drizzle-orm';
import { getDb } from '../src/lib/db/client';

config({ path: '.env.local' });

const DEBUG = true;

function debugLog(message: string, meta?: Record<string, unknown>) {
  if (!DEBUG) return;
  if (meta) {
    console.debug(`[baseline-migrations] ${message}`, meta);
  } else {
    console.debug(`[baseline-migrations] ${message}`);
  }
}

async function main() {
  const db = getDb();
  const migrations = readMigrationFiles({ migrationsFolder: 'drizzle' });

  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  const existingRows = await db.execute(
    sql`SELECT hash, created_at FROM "drizzle"."__drizzle_migrations"`
  );
  const existing = new Set(
    Array.isArray(existingRows) ? existingRows.map((row: any) => row.hash) : []
  );

  let inserted = 0;
  for (const migration of migrations) {
    if (existing.has(migration.hash)) continue;
    await db.execute(
      sql`INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
    );
    inserted += 1;
    debugLog('inserted', { hash: migration.hash, createdAt: migration.folderMillis });
  }

  console.log(`[baseline-migrations] inserted ${inserted} migration record(s)`);
}

main().catch(error => {
  console.error('[baseline-migrations] failed:', error?.message ?? error);
  process.exit(1);
});
