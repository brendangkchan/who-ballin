/**
 * Builds a mapping from Ball Don't Lie player IDs to NBA.com headshot IDs.
 * Run from project root: npm run build-map
 * (Loads BALLDONTLIE_API_KEY from .env.local if present.)
 *
 * Uses checkpoint/resume: if rate limited (429), progress is saved; run again to continue.
 * Rate limit: 12 req/min (5s between requests).
 */

import * as fs from 'fs';
import * as path from 'path';
import { getPlayersPage } from '../src/lib/balldontlie';
import {
  loadCheckpoint,
  runBuildMap,
  BuildMapError,
  getUnmatchedSample,
} from './build-map-utils';

// Load .env.local so BALLDONTLIE_API_KEY is available when run via npm run build-map
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf-8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const ROOT = path.resolve(__dirname, '..');
const REFERENCE_PATH = path.join(ROOT, 'scripts', 'nba-name-to-id-reference.json');
const OUTPUT_PATH = path.join(ROOT, 'src', 'lib', 'nba-player-id-map.json');
const CHECKPOINT_PATH = path.join(ROOT, 'scripts', '.build-map-checkpoint.json');

async function main() {
  if (!process.env.BALLDONTLIE_API_KEY) {
    console.error('Set BALLDONTLIE_API_KEY to run this script.');
    process.exit(1);
  }

  const checkpoint = loadCheckpoint(CHECKPOINT_PATH);
  if (checkpoint) {
    if (checkpoint.nextCursor === null && checkpoint.players.length > 0) {
      console.log('Checkpoint indicates fetch already complete. Running matching...');
    } else {
      console.log(`Resuming from checkpoint (${checkpoint.players.length} players so far).`);
    }
  } else {
    console.log('Fetching all players from Ball Don\'t Lie...');
  }

  const refRaw = fs.readFileSync(REFERENCE_PATH, 'utf-8');
  const reference = JSON.parse(refRaw);
  console.log(`Reference list: ${reference.length} names to match.`);

  const result = await runBuildMap({
    getPage: getPlayersPage,
    referencePath: REFERENCE_PATH,
    outputPath: OUTPUT_PATH,
    checkpointPath: CHECKPOINT_PATH,
    delayMs: 5000,
    retryDelayMs: 8000,
    maxRetries: 2,
    onProgress: (pageCount, totalPlayers) =>
      console.log(`  Page ${pageCount} — ${totalPlayers} players total.`),
  });

  console.log(`Fetched ${result.playersCount} players. Matching names to NBA IDs...`);
  if (result.unmatched.length > 0) {
    console.log(
      `${result.unmatched.length} reference names had no BDL match. Sample: ${getUnmatchedSample(result.unmatched, 5)}`
    );
  }
  console.log(`Wrote ${Object.keys(result.map).length} mappings to ${OUTPUT_PATH}.`);
}

main().catch((err) => {
  if (err instanceof BuildMapError) {
    console.error(err.message);
    process.exit(err.exitCode);
  }
  console.error(err);
  process.exit(1);
});
