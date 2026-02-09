import { config } from 'dotenv';
import { createDbAdapter } from '../src/lib/db/adapter';
import { getDb } from '../src/lib/db/client';
import { getPlayersPage } from '../src/lib/balldontlie';

config({ path: '.env.local' });

const RATE_LIMIT_PER_MIN = 60;
const TOKEN_REFILL_MS = 60_000;
const TOKEN_REFILL_RATE = RATE_LIMIT_PER_MIN / TOKEN_REFILL_MS;
const STATE_KEY = 'backfill_players_state';

const DEBUG = true;

function debugLog(message: string, meta?: Record<string, unknown>) {
  if (!DEBUG) return;
  if (meta) {
    console.debug(`[backfill-players] ${message}`, meta);
  } else {
    console.debug(`[backfill-players] ${message}`);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type BackfillState = {
  cursor: number | null;
  tokens: number;
  lastRefillMs: number;
};

function refillTokens(state: BackfillState): void {
  const now = Date.now();
  const elapsed = now - state.lastRefillMs;
  if (elapsed <= 0) return;
  const refill = elapsed * TOKEN_REFILL_RATE;
  state.tokens = Math.min(RATE_LIMIT_PER_MIN, state.tokens + refill);
  state.lastRefillMs = now;
  debugLog('refill_tokens', { tokens: state.tokens, lastRefillMs: state.lastRefillMs });
}

async function takeToken(state: BackfillState): Promise<void> {
  while (true) {
    refillTokens(state);
    if (state.tokens >= 1) {
      state.tokens -= 1;
      debugLog('token_acquired', { tokens: state.tokens });
      return;
    }
    const needed = 1 - state.tokens;
    const waitMs = Math.ceil(needed / TOKEN_REFILL_RATE);
    debugLog('token_wait', { waitMs, tokens: state.tokens });
    await sleep(waitMs);
  }
}

function toState(value: unknown): BackfillState | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<BackfillState>;
  const cursor = typeof v.cursor === 'number' ? v.cursor : null;
  const tokens = typeof v.tokens === 'number' ? v.tokens : RATE_LIMIT_PER_MIN;
  const lastRefillMs = typeof v.lastRefillMs === 'number' ? v.lastRefillMs : Date.now();
  return { cursor, tokens, lastRefillMs };
}

async function main() {
  const adapter = createDbAdapter(getDb());
  const stored = await adapter.getSyncState(STATE_KEY);
  const state = toState(stored) ?? {
    cursor: null,
    tokens: RATE_LIMIT_PER_MIN,
    lastRefillMs: Date.now(),
  };
  let cursor: number | null = state.cursor;
  debugLog('start', { cursor, tokens: state.tokens });
  let total = 0;

  while (true) {
    await takeToken(state);
    debugLog('request_page', { cursor });
    const page = await getPlayersPage(cursor);
    if (page.status === 429) {
      debugLog('rate_limited', { cursor });
      await adapter.upsertSyncState(STATE_KEY, {
        cursor,
        tokens: state.tokens,
        lastRefillMs: state.lastRefillMs,
        updatedAt: new Date().toISOString(),
      });
      await sleep(1000);
      continue;
    }
    if (page.invalidResponse) {
      throw new Error('Invalid players response from balldontlie');
    }

    debugLog('page_received', { count: page.data.length, nextCursor: page.nextCursor });
    const rows = page.data.map(p => ({
      id: p.id,
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      position: p.position ?? null,
      updatedAt: new Date(),
    }));

    await adapter.upsertPlayers(rows);
    total += rows.length;
    debugLog('page_upserted', { total, cursor, nextCursor: page.nextCursor });

    if (page.nextCursor == null) break;
    cursor = page.nextCursor;

    await adapter.upsertSyncState(STATE_KEY, {
      cursor,
      tokens: state.tokens,
      lastRefillMs: state.lastRefillMs,
      updatedAt: new Date().toISOString(),
    });
  }

  await adapter.upsertSyncState(STATE_KEY, {
    cursor: null,
    tokens: state.tokens,
    lastRefillMs: state.lastRefillMs,
    updatedAt: new Date().toISOString(),
  });

  debugLog('complete', { total });
  console.log(`[backfill-players] upserted ${total} players`);
}

main().catch(error => {
  console.error('[backfill-players] failed:', error?.message ?? error);
  process.exit(1);
});
