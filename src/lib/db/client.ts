import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

let cachedDb: NeonHttpDatabase<Record<string, never>> | null = null;

export function getDb() {
  if (cachedDb) return cachedDb;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = neon(databaseUrl);
  cachedDb = drizzle({ client: sql });
  return cachedDb;
}
