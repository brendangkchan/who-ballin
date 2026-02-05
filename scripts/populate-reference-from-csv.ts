/**
 * Fetches NBA_Player_IDs.csv from djblechn-su/nba-player-team-ids, parses it into
 * the reference format (first_name, last_name, nba_id), and writes
 * scripts/nba-name-to-id-reference.json for use by the build-map script.
 *
 * Run: npm run populate-reference
 * Optional: POPULATE_REFERENCE_SOURCE=./path/to/local.csv to use a local file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { nameKey } from './build-map-utils';

const CSV_URL =
  'https://raw.githubusercontent.com/djblechn-su/nba-player-team-ids/master/NBA_Player_IDs.csv';
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'scripts', 'nba-name-to-id-reference.json');

interface ReferenceEntry {
  first_name: string;
  last_name: string;
  nba_id: number;
}

function parseName(nbaName: string): { first_name: string; last_name: string } | null {
  const trimmed = nbaName.trim();
  if (!trimmed) return null;
  if (trimmed.includes(',')) {
    const [last, ...firstParts] = trimmed.split(',');
    const first = firstParts.join(',').trim();
    return first && last ? { first_name: first, last_name: last.trim() } : null;
  }
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace <= 0) return null;
  return {
    first_name: trimmed.slice(0, lastSpace).trim(),
    last_name: trimmed.slice(lastSpace + 1).trim(),
  };
}

function getNbaId(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/^["']|["']$/g, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

async function getCsvContent(): Promise<string> {
  const source = process.env.POPULATE_REFERENCE_SOURCE;
  if (source) {
    const filePath = path.isAbsolute(source) ? source : path.join(ROOT, source);
    return fs.readFileSync(filePath, 'utf-8');
  }
  const res = await fetch(CSV_URL, { headers: { Accept: 'text/csv' } });
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`);
  return res.text();
}

async function main() {
  console.log('Fetching NBA player IDs CSV...');
  const csvText = await getCsvContent();
  const rows = parse(csvText, { columns: true, skip_empty_lines: true }) as Record<
    string,
    string
  >[];

  const seen = new Map<string, ReferenceEntry>();
  let skipped = 0;

  for (const row of rows) {
    const nbaName = row.NBAName ?? row.nbaname ?? '';
    const nbaId = getNbaId(row.NBAID ?? row.nbaid ?? row.NBAId);
    if (!nbaName.trim()) {
      skipped++;
      continue;
    }
    if (nbaId == null) {
      skipped++;
      continue;
    }
    const names = parseName(nbaName);
    if (!names) {
      skipped++;
      continue;
    }
    const entry: ReferenceEntry = {
      first_name: names.first_name,
      last_name: names.last_name,
      nba_id: nbaId,
    };
    const key = nameKey(entry.first_name, entry.last_name);
    seen.set(key, entry);
  }

  const reference = Array.from(seen.values()).sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
  );

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(reference, null, 2), 'utf-8');
  console.log(`Fetched ${rows.length} rows, wrote ${reference.length} entries to ${OUTPUT_PATH}.`);
  if (skipped > 0) console.log(`Skipped ${skipped} rows.`);
  if (reference.length > 0) {
    console.log(
      `Sample: ${reference.slice(0, 3).map((r) => `${r.first_name} ${r.last_name} (${r.nba_id})`).join(', ')}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
