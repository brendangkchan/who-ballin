/**
 * Applies manually filled NBA IDs from manual-nba-ids.json into the BDL→NBA map,
 * then removes those entries from the manual file. Run: npm run apply-manual-ids
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'src', 'lib', 'nba-player-id-map.json');
const MANUAL_PATH = path.join(ROOT, 'scripts', 'manual-nba-ids.json');

interface ManualEntry {
  bdl_id: number;
  first_name: string;
  last_name: string;
  nba_id: number | null;
}

function log(msg: string): void {
  console.log(`[apply-manual-ids] ${msg}`);
}

function main(): void {
  log('Starting apply-manual-nba-ids.');

  if (!fs.existsSync(MANUAL_PATH)) {
    log('No manual file found. Nothing to apply.');
    return;
  }

  let manual: ManualEntry[];
  try {
    const raw = fs.readFileSync(MANUAL_PATH, 'utf-8');
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) {
      console.error('Manual file is not a JSON array.');
      process.exit(1);
    }
    manual = arr.filter(
      (e): e is ManualEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as ManualEntry).bdl_id === 'number' &&
        typeof (e as ManualEntry).first_name === 'string' &&
        typeof (e as ManualEntry).last_name === 'string'
    );
  } catch (err) {
    console.error('Failed to read manual file:', err);
    process.exit(1);
  }

  const toApply = manual.filter((e) => e.nba_id != null && Number.isInteger(e.nba_id));
  if (toApply.length === 0) {
    log('No entries with nba_id set. Fill in nba_id in manual-nba-ids.json and run again.');
    return;
  }

  let map: Record<string, number> = {};
  if (fs.existsSync(MAP_PATH)) {
    const raw = fs.readFileSync(MAP_PATH, 'utf-8');
    map = JSON.parse(raw) as Record<string, number>;
    if (typeof map !== 'object' || map === null) map = {};
  }

  let applied = 0;
  for (const e of toApply) {
    map[String(e.bdl_id)] = e.nba_id!;
    applied++;
  }

  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2), 'utf-8');
  log(`Applied ${applied} entries to map.`);

  const remaining = manual.filter((e) => e.nba_id == null || !Number.isInteger(e.nba_id));
  fs.writeFileSync(MANUAL_PATH, JSON.stringify(remaining, null, 2), 'utf-8');
  log(`Removed applied entries from manual file. ${remaining.length} entries remaining for manual fill.`);
}

main();
