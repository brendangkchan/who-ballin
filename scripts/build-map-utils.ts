/**
 * Testable utilities for the build-map script. Used by fetch-nba-player-ids.ts and tests.
 */

import * as fs from 'fs';

export const STATUS_MESSAGES: Record<number, string> = {
  500:
    'Internal Server Error — API error. Try again; if it persists, the provider may be having issues.',
  502: 'Bad Gateway — API or upstream had a temporary problem. Try again in a few minutes.',
  503: 'Service Unavailable — API is overloaded or down. Try again later.',
  504: "Gateway Timeout — Upstream didn't respond in time. Try again.",
};

export function getStatusMessage(status: number): string {
  return (
    STATUS_MESSAGES[status] ??
    `Request failed: ${status}. Progress saved. Run again to resume.`
  );
}

export function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

export function nameKey(first: string, last: string): string {
  return `${normalizeName(first)}|${normalizeName(last)}`;
}

export interface ReferenceEntry {
  first_name: string;
  last_name: string;
  nba_id: number;
}

export function buildIdMap(
  players: { id: number; first_name?: string; last_name?: string }[],
  reference: ReferenceEntry[]
): { map: Record<string, number>; unmatched: ReferenceEntry[] } {
  const nameToNbaId = new Map<string, number>();
  for (const r of reference) {
    nameToNbaId.set(nameKey(r.first_name, r.last_name), r.nba_id);
  }
  const map: Record<string, number> = {};
  const matchedRefKeys = new Set<string>();
  for (const p of players) {
    const key = nameKey(p.first_name ?? '', p.last_name ?? '');
    const nbaId = nameToNbaId.get(key);
    if (nbaId != null) {
      map[String(p.id)] = nbaId;
      matchedRefKeys.add(key);
    }
  }
  const unmatched = reference.filter(
    (r) => !matchedRefKeys.has(nameKey(r.first_name, r.last_name))
  );
  return { map, unmatched };
}

export function getUnmatchedSample(
  unmatched: ReferenceEntry[],
  max: number = 5
): string {
  return unmatched
    .slice(0, max)
    .map((r) => `${r.first_name} ${r.last_name}`)
    .join(', ');
}

export interface Checkpoint {
  players: any[];
  nextCursor: number | null;
}

export function loadCheckpoint(
  checkpointPath: string,
  fsModule: Pick<typeof fs, 'existsSync' | 'readFileSync' | 'unlinkSync'> = fs
): Checkpoint | null {
  if (!fsModule.existsSync(checkpointPath)) return null;
  try {
    const raw = fsModule.readFileSync(checkpointPath, 'utf-8');
    const c = JSON.parse(raw) as Checkpoint;
    if (
      Array.isArray(c.players) &&
      (c.nextCursor === null || typeof c.nextCursor === 'number')
    ) {
      return c;
    }
  } catch {
    fsModule.unlinkSync(checkpointPath);
  }
  return null;
}

export function saveCheckpoint(
  checkpointPath: string,
  c: Checkpoint,
  fsModule: Pick<typeof fs, 'writeFileSync'> = fs
): void {
  fsModule.writeFileSync(
    checkpointPath,
    JSON.stringify(c),
    'utf-8'
  );
}

export function deleteCheckpoint(
  checkpointPath: string,
  fsModule: Pick<typeof fs, 'existsSync' | 'unlinkSync'> = fs
): void {
  if (fsModule.existsSync(checkpointPath)) fsModule.unlinkSync(checkpointPath);
}

export class BuildMapError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'BuildMapError';
  }
}

export interface RunBuildMapOptions {
  getPage: (
    cursor: number | null
  ) => Promise<{
    data: any[];
    nextCursor: number | null;
    status: number;
    invalidResponse?: boolean;
  }>;
  referencePath: string;
  outputPath: string;
  checkpointPath: string;
  delayMs?: number;
  retryDelayMs?: number;
  maxRetries?: number;
  fsModule?: typeof fs;
  onProgress?: (pageCount: number, totalPlayers: number) => void;
}

export async function runBuildMap(
  options: RunBuildMapOptions
): Promise<{
  map: Record<string, number>;
  playersCount: number;
  unmatched: ReferenceEntry[];
}> {
  const {
    getPage,
    referencePath,
    outputPath,
    checkpointPath,
    delayMs = 5000,
    retryDelayMs = 8000,
    maxRetries = 2,
    fsModule = fs,
    onProgress,
  } = options;

  let refRaw: string;
  try {
    refRaw = fsModule.readFileSync(referencePath, 'utf-8');
  } catch (err) {
    throw new BuildMapError(
      err instanceof Error ? err.message : String(err),
      1
    );
  }
  let reference: ReferenceEntry[];
  try {
    reference = JSON.parse(refRaw);
  } catch (err) {
    throw new BuildMapError(
      err instanceof Error ? err.message : String(err),
      1
    );
  }

  const nameToNbaId = new Map<string, number>();
  for (const r of reference) {
    nameToNbaId.set(nameKey(r.first_name, r.last_name), r.nba_id);
  }

  let players: any[] = [];
  let nextCursor: number | null = null;
  const checkpoint = loadCheckpoint(checkpointPath, fsModule);

  if (checkpoint) {
    players = checkpoint.players;
    nextCursor = checkpoint.nextCursor;
  }

  let pageCount = 0;
  while (true) {
    if (nextCursor === null && players.length > 0) {
      break;
    }

    if (pageCount > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    let result: Awaited<ReturnType<typeof getPage>>;
    let attempt = 0;
    while (true) {
      try {
        result = await getPage(nextCursor);
      } catch (err) {
        if (attempt >= maxRetries) {
          saveCheckpoint(checkpointPath, { players, nextCursor }, fsModule);
          const msg = err instanceof Error ? err.message : String(err);
          throw new BuildMapError(
            `Network or request error: ${msg}. Progress saved. Run again to resume.`,
            1
          );
        }
        attempt++;
        await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }
      if (result.status === 429) {
        saveCheckpoint(checkpointPath, { players, nextCursor }, fsModule);
        throw new BuildMapError(
          'Rate limited (429). Progress saved. Run npm run build-map again to resume.',
          1
        );
      }
      if (result.status !== 200) {
        const isRetryable =
          result.status >= 500 &&
          result.status <= 504 &&
          attempt < maxRetries;
        if (isRetryable) {
          attempt++;
          await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }
        saveCheckpoint(checkpointPath, { players, nextCursor }, fsModule);
        throw new BuildMapError(getStatusMessage(result.status), 1);
      }
      if (result.invalidResponse) {
        if (attempt < 1) {
          attempt++;
          await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }
        saveCheckpoint(checkpointPath, { players, nextCursor }, fsModule);
        throw new BuildMapError(
          'Unexpected API response. Progress saved. Run again to resume.',
          1
        );
      }
      break;
    }

    const pageResult = result!;
    if (pageResult.data.length === 0) break;
    players.push(...pageResult.data);
    nextCursor = pageResult.nextCursor;
    pageCount++;
    onProgress?.(pageCount, players.length);

    saveCheckpoint(checkpointPath, { players, nextCursor }, fsModule);
    if (nextCursor === null) break;
  }

  // Keep checkpoint so fill-map can use the BDL player list (see scripts/fill-missing-nba-ids.ts).

  const { map, unmatched } = buildIdMap(players, reference);
  fsModule.writeFileSync(
    outputPath,
    JSON.stringify(map, null, 2),
    'utf-8'
  );

  return { map, playersCount: players.length, unmatched };
}
