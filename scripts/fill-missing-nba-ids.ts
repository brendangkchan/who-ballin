/**
 * Fills BDL → NBA ID map for players missing from the map by matching names
 * against the NBA stats API (commonallplayers). Requires a prior run of build-map
 * so the checkpoint exists. Writes failed (unmatched) names to manual-nba-ids.json
 * for manual fill-in. Run: npm run fill-map
 */

import * as fs from 'fs';
import * as path from 'path';
import { nameKey } from './build-map-utils';
import { loadCheckpoint } from './build-map-utils';

const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'src', 'lib', 'nba-player-id-map.json');
const CHECKPOINT_PATH = path.join(ROOT, 'scripts', '.build-map-checkpoint.json');
const MANUAL_PATH = path.join(ROOT, 'scripts', 'manual-nba-ids.json');

const NBA_STATS_BASE = 'https://stats.nba.com/stats/commonallplayers';
const NBA_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://stats.nba.com/',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface ManualEntry {
  bdl_id: number;
  first_name: string;
  last_name: string;
  nba_id: number | null;
}

function log(msg: string): void {
  console.log(`[fill-map] ${msg}`);
}

function getCurrentSeason(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  // NBA season crosses calendar year; e.g. 2024-25 runs Oct 2024 - Jun 2025
  const seasonYear = month >= 10 ? year : year - 1;
  const nextYear = (seasonYear + 1) % 100;
  return `${seasonYear}-${String(nextYear).padStart(2, '0')}`;
}

function getPreviousSeason(current: string): string {
  const [y, yy] = current.split('-').map(Number);
  const prevY = y - 1;
  const prevYY = y % 100;
  return `${prevY}-${String(prevYY).padStart(2, '0')}`;
}

async function fetchCommonAllPlayers(season: string): Promise<{ personId: number; first: string; last: string; toYear: number }[]> {
  const url = `${NBA_STATS_BASE}?LeagueID=00&Season=${season}&IsOnlyCurrentSeason=0`;
  log(`Fetching NBA commonallplayers for ${season}...`);
  const res = await fetch(url, { headers: NBA_HEADERS });
  if (!res.ok) {
    throw new Error(`NBA API returned ${res.status}; try again or check network.`);
  }
  const data = (await res.json()) as {
    resultSets?: { name: string; headers: string[]; rowSet: unknown[][] }[];
  };
  const rs = data?.resultSets?.[0];
  if (!rs || !Array.isArray(rs.headers) || !Array.isArray(rs.rowSet)) {
    throw new Error('Unexpected NBA API response shape.');
  }
  const headers = rs.headers as string[];
  const idxId = headers.indexOf('PERSON_ID');
  const idxDisplay = headers.indexOf('DISPLAY_LAST_COMMA_FIRST');
  const idxFirstLast = headers.indexOf('DISPLAY_FIRST_LAST');
  const idxToYear = headers.indexOf('TO_YEAR');
  if (idxId === -1 || (idxDisplay === -1 && idxFirstLast === -1)) {
    throw new Error('NBA API response missing PERSON_ID or display name column.');
  }
  const rows: { personId: number; first: string; last: string; toYear: number }[] = [];
  for (const row of rs.rowSet) {
    const personId = Number(row[idxId]);
    if (Number.isNaN(personId)) continue;
    let first = '';
    let last = '';
    if (idxDisplay !== -1 && row[idxDisplay]) {
      const s = String(row[idxDisplay]).trim();
      const comma = s.indexOf(',');
      if (comma !== -1) {
        last = s.slice(0, comma).trim();
        first = s.slice(comma + 1).trim();
      }
    }
    if ((!first || !last) && idxFirstLast !== -1 && row[idxFirstLast]) {
      const s = String(row[idxFirstLast]).trim();
      const space = s.lastIndexOf(' ');
      if (space !== -1) {
        first = s.slice(0, space).trim();
        last = s.slice(space + 1).trim();
      }
    }
    if (!first && !last) continue;
    const toYear = idxToYear !== -1 ? Number(row[idxToYear]) || 0 : 0;
    rows.push({ personId, first, last, toYear });
  }
  log(`  Parsed ${rows.length} players for ${season}.`);
  return rows;
}

function buildNbaLookup(
  seasonRows: { personId: number; first: string; last: string; toYear: number }[][]
): Map<string, number> {
  const byKey = new Map<string, { personId: number; toYear: number }>();
  for (const rows of seasonRows) {
    for (const r of rows) {
      const key = nameKey(r.first, r.last);
      const existing = byKey.get(key);
      if (existing == null || r.toYear > existing.toYear) {
        byKey.set(key, { personId: r.personId, toYear: r.toYear });
      }
    }
  }
  const map = new Map<string, number>();
  for (const [k, v] of byKey) map.set(k, v.personId);
  return map;
}

function loadMap(): Record<string, number> {
  const raw = fs.readFileSync(MAP_PATH, 'utf-8');
  const map = JSON.parse(raw) as Record<string, number>;
  if (typeof map !== 'object' || map === null) return {};
  return map;
}

function loadManualFile(): ManualEntry[] {
  if (!fs.existsSync(MANUAL_PATH)) return [];
  try {
    const raw = fs.readFileSync(MANUAL_PATH, 'utf-8');
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is ManualEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as ManualEntry).bdl_id === 'number' &&
        typeof (e as ManualEntry).first_name === 'string' &&
        typeof (e as ManualEntry).last_name === 'string'
    );
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  log('Starting fill-missing-nba-ids (Option A: requires prior build-map run).');

  if (!fs.existsSync(MAP_PATH)) {
    console.error('[fill-map] Map file not found. Run npm run build-map first.');
    process.exit(1);
  }

  const map = loadMap();
  log(`Loaded map: ${Object.keys(map).length} entries.`);

  const checkpoint = loadCheckpoint(CHECKPOINT_PATH);
  if (!checkpoint || checkpoint.players.length === 0 || checkpoint.nextCursor !== null) {
    console.error(
      '[fill-map] No complete checkpoint found. Run npm run build-map once (let it finish) so the checkpoint exists.'
    );
    process.exit(1);
  }

  const players = checkpoint.players as { id: number; first_name?: string; last_name?: string }[];
  log(`Checkpoint: ${players.length} BDL players.`);

  const missing = players.filter((p) => map[String(p.id)] == null);
  log(`Missing NBA ID for ${missing.length} BDL players.`);

  if (missing.length === 0) {
    log('Nothing to fill. Exiting.');
    return;
  }

  const currentSeason = getCurrentSeason();
  const previousSeason = getPreviousSeason(currentSeason);
  const seasons = [currentSeason, previousSeason];

  const allRows: { personId: number; first: string; last: string; toYear: number }[][] = [];
  for (let i = 0; i < seasons.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 500));
    const rows = await fetchCommonAllPlayers(seasons[i]);
    allRows.push(rows);
  }

  const nbaLookup = buildNbaLookup(allRows);
  log(`NBA name lookup: ${nbaLookup.size} names.`);

  const newMappings: Record<string, number> = {};
  const failed: { id: number; first_name: string; last_name: string }[] = [];

  for (const p of missing) {
    const first = p.first_name ?? '';
    const last = p.last_name ?? '';
    const key = nameKey(first, last);
    const nbaId = nbaLookup.get(key);
    if (nbaId != null) {
      newMappings[String(p.id)] = nbaId;
    } else {
      failed.push({ id: p.id, first_name: first, last_name: last });
    }
  }

  const matchedCount = Object.keys(newMappings).length;
  log(`Matched ${matchedCount} players; ${failed.length} failed (no NBA match).`);

  if (matchedCount > 0) {
    const merged = { ...map, ...newMappings };
    fs.writeFileSync(MAP_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    log(`Wrote ${matchedCount} new mappings to ${MAP_PATH}.`);
  }

  if (failed.length > 0) {
    const existingManual = loadManualFile();
    const existingIds = new Set(existingManual.map((e) => e.bdl_id));
    const newEntries: ManualEntry[] = failed
      .filter((f) => !existingIds.has(f.id))
      .map((f) => ({
        bdl_id: f.id,
        first_name: f.first_name,
        last_name: f.last_name,
        nba_id: null,
      }));
    const mergedManual = [...existingManual];
    for (const e of newEntries) {
      mergedManual.push(e);
      existingIds.add(e.bdl_id);
    }
    fs.writeFileSync(MANUAL_PATH, JSON.stringify(mergedManual, null, 2), 'utf-8');
    log(`Wrote ${newEntries.length} new failed names to ${MANUAL_PATH} (${mergedManual.length} total entries for manual fill).`);
  }

  log(`Done. Successfully matched: ${matchedCount}; failed: ${failed.length}.`);
}

main().catch((err) => {
  console.error('[fill-map]', err);
  process.exit(1);
});
