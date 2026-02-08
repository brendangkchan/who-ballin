import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeName,
  nameKey,
  getStatusMessage,
  buildIdMap,
  getUnmatchedSample,
  loadCheckpoint,
  saveCheckpoint,
  deleteCheckpoint,
  runBuildMap,
  BuildMapError,
  type ReferenceEntry,
  type Checkpoint,
} from './build-map-utils';

describe('normalizeName', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeName('')).toBe('');
  });
  it('trims and lowercases', () => {
    expect(normalizeName('  LeBron  ')).toBe('lebron');
  });
  it('handles already normalized', () => {
    expect(normalizeName('stephen')).toBe('stephen');
  });
});

describe('nameKey', () => {
  it('produces same key for same name with different casing', () => {
    expect(nameKey('LeBron', 'James')).toBe(nameKey('lebron', 'james'));
  });
  it('produces different keys for different names', () => {
    expect(nameKey('Jalen', 'Smith')).not.toBe(nameKey('Jalen', 'Johnson'));
  });
  it('uses pipe separator', () => {
    expect(nameKey('a', 'b')).toBe('a|b');
  });
});

describe('getStatusMessage', () => {
  it('returns known message for 500, 502, 503, 504', () => {
    expect(getStatusMessage(500)).toContain('Internal Server Error');
    expect(getStatusMessage(502)).toContain('Bad Gateway');
    expect(getStatusMessage(503)).toContain('Service Unavailable');
    expect(getStatusMessage(504)).toContain('Gateway Timeout');
  });
  it('returns generic message for unknown status', () => {
    const msg = getStatusMessage(999);
    expect(msg).toContain('999');
    expect(msg).toContain('Progress saved');
  });
});

describe('buildIdMap', () => {
  const reference: ReferenceEntry[] = [
    { first_name: 'LeBron', last_name: 'James', nba_id: 2544 },
    { first_name: 'Stephen', last_name: 'Curry', nba_id: 201939 },
  ];

  it('returns empty map and full unmatched when no players', () => {
    const { map, unmatched } = buildIdMap([], reference);
    expect(map).toEqual({});
    expect(unmatched).toHaveLength(2);
    expect(unmatched.map((r) => r.last_name)).toEqual(['James', 'Curry']);
  });

  it('maps one matching player', () => {
    const { map, unmatched } = buildIdMap(
      [{ id: 100, first_name: 'LeBron', last_name: 'James' }],
      reference
    );
    expect(map).toEqual({ '100': 2544 });
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].last_name).toBe('Curry');
  });

  it('ignores player not in reference', () => {
    const { map, unmatched } = buildIdMap(
      [{ id: 99, first_name: 'Unknown', last_name: 'Player' }],
      reference
    );
    expect(map).toEqual({});
    expect(unmatched).toHaveLength(2);
  });

  it('matches case-insensitively', () => {
    const { map } = buildIdMap(
      [{ id: 1, first_name: 'STEPHEN', last_name: 'curry' }],
      reference
    );
    expect(map).toEqual({ '1': 201939 });
  });

  it('returns correct unmatched list', () => {
    const { map, unmatched } = buildIdMap(
      [
        { id: 1, first_name: 'LeBron', last_name: 'James' },
        { id: 2, first_name: 'Stephen', last_name: 'Curry' },
      ],
      reference
    );
    expect(Object.keys(map)).toHaveLength(2);
    expect(unmatched).toHaveLength(0);
  });
});

describe('getUnmatchedSample', () => {
  const refs: ReferenceEntry[] = [
    { first_name: 'A', last_name: 'One', nba_id: 1 },
    { first_name: 'B', last_name: 'Two', nba_id: 2 },
    { first_name: 'C', last_name: 'Three', nba_id: 3 },
    { first_name: 'D', last_name: 'Four', nba_id: 4 },
    { first_name: 'E', last_name: 'Five', nba_id: 5 },
    { first_name: 'F', last_name: 'Six', nba_id: 6 },
  ];

  it('returns empty string for empty unmatched', () => {
    expect(getUnmatchedSample([])).toBe('');
  });
  it('caps at max (default 5)', () => {
    const sample = getUnmatchedSample(refs, 5);
    expect(sample.split(', ')).toHaveLength(5);
    expect(sample).toContain('A One');
    expect(sample).not.toContain('F Six');
  });
  it('respects custom max', () => {
    const sample = getUnmatchedSample(refs, 2);
    expect(sample.split(', ')).toHaveLength(2);
  });
});

describe('checkpoint load/save/delete', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-map-test-'));
  });

  it('loadCheckpoint returns null when file does not exist', () => {
    expect(loadCheckpoint(path.join(tmpDir, 'nonexistent.json'))).toBeNull();
  });

  it('loadCheckpoint deletes file and returns null on parse error', () => {
    const p = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(p, 'not json', 'utf-8');
    expect(loadCheckpoint(p)).toBeNull();
    expect(fs.existsSync(p)).toBe(false);
  });

  it('loadCheckpoint returns null for invalid shape (nextCursor string), does not delete', () => {
    const p = path.join(tmpDir, 'shape.json');
    fs.writeFileSync(
      p,
      JSON.stringify({ players: [], nextCursor: '123' }),
      'utf-8'
    );
    expect(loadCheckpoint(p)).toBeNull();
    expect(fs.existsSync(p)).toBe(true);
  });

  it('loadCheckpoint returns null for invalid shape (players not array)', () => {
    const p = path.join(tmpDir, 'shape2.json');
    fs.writeFileSync(
      p,
      JSON.stringify({ players: {}, nextCursor: null }),
      'utf-8'
    );
    expect(loadCheckpoint(p)).toBeNull();
  });

  it('loadCheckpoint returns data for valid checkpoint', () => {
    const p = path.join(tmpDir, 'ok.json');
    const data: Checkpoint = { players: [{ id: 1 }], nextCursor: 100 };
    saveCheckpoint(p, data);
    expect(loadCheckpoint(p)).toEqual(data);
  });

  it('deleteCheckpoint removes file when it exists', () => {
    const p = path.join(tmpDir, 'del.json');
    fs.writeFileSync(p, '{}', 'utf-8');
    deleteCheckpoint(p);
    expect(fs.existsSync(p)).toBe(false);
  });
});

describe('runBuildMap', () => {
  let tmpDir: string;
  let referencePath: string;
  let outputPath: string;
  let checkpointPath: string;
  const reference: ReferenceEntry[] = [
    { first_name: 'LeBron', last_name: 'James', nba_id: 2544 },
  ];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-build-map-'));
    referencePath = path.join(tmpDir, 'reference.json');
    outputPath = path.join(tmpDir, 'output.json');
    checkpointPath = path.join(tmpDir, 'checkpoint.json');
    fs.writeFileSync(referencePath, JSON.stringify(reference), 'utf-8');
  });

  it('throws BuildMapError on 429 and saves checkpoint', async () => {
    const getPage = vi.fn().mockResolvedValue({
      data: [],
      nextCursor: null,
      status: 429,
    });
    let err: BuildMapError | null = null;
    await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
    }).catch((e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(BuildMapError);
    expect(err!.message).toContain('429');
    expect(fs.existsSync(checkpointPath)).toBe(true);
    const cp = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
    expect(cp.players).toEqual([]);
    expect(cp.nextCursor).toBeNull();
  });

  it('retries on 502 then succeeds', async () => {
    const getPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [], nextCursor: null, status: 502 })
      .mockResolvedValueOnce({
        data: [{ id: 100, first_name: 'LeBron', last_name: 'James' }],
        nextCursor: null,
        status: 200,
      });
    const result = await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
    });
    expect(result.map).toEqual({ '100': 2544 });
    expect(getPage).toHaveBeenCalledTimes(2);
    expect(fs.existsSync(checkpointPath)).toBe(true);
  });

  it('throws after max retries on network error and saves checkpoint', async () => {
    const getPage = vi.fn().mockRejectedValue(new Error('fetch failed'));
    let err: BuildMapError | null = null;
    await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
      maxRetries: 2,
    }).catch((e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(BuildMapError);
    expect(err!.message).toContain('Network or request error');
    expect(fs.existsSync(checkpointPath)).toBe(true);
  });

  it('does not retry on 401, throws and saves checkpoint', async () => {
    const getPage = vi.fn().mockResolvedValue({
      data: [],
      nextCursor: null,
      status: 401,
    });
    let err: BuildMapError | null = null;
    await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
    }).catch((e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(BuildMapError);
    expect(getPage).toHaveBeenCalledTimes(1);
    expect(err!.message).toContain('Request failed');
    expect(fs.existsSync(checkpointPath)).toBe(true);
  });

  it('retries once on invalidResponse then succeeds', async () => {
    const getPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [],
        nextCursor: null,
        status: 200,
        invalidResponse: true,
      })
      .mockResolvedValueOnce({
        data: [{ id: 1, first_name: 'LeBron', last_name: 'James' }],
        nextCursor: null,
        status: 200,
      });
    const result = await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
    });
    expect(result.map).toEqual({ '1': 2544 });
    expect(getPage).toHaveBeenCalledTimes(2);
  });

  it('succeeds from scratch with two pages', async () => {
    const getPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 1, first_name: 'LeBron', last_name: 'James' }],
        nextCursor: 200,
        status: 200,
      })
      .mockResolvedValueOnce({
        data: [],
        nextCursor: null,
        status: 200,
      });
    const result = await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
    });
    expect(result.playersCount).toBe(1);
    expect(result.map).toEqual({ '1': 2544 });
    expect(fs.existsSync(checkpointPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(written).toEqual({ '1': 2544 });
  });

  it('resumes from checkpoint and completes', async () => {
    const existingPlayers = [{ id: 50, first_name: 'LeBron', last_name: 'James' }];
    saveCheckpoint(checkpointPath, {
      players: existingPlayers,
      nextCursor: 300,
    });
    const getPage = vi.fn().mockResolvedValue({
      data: [],
      nextCursor: null,
      status: 200,
    });
    const result = await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
    });
    expect(result.playersCount).toBe(1);
    expect(result.map).toEqual({ '50': 2544 });
    expect(getPage).toHaveBeenCalledWith(300);
    expect(fs.existsSync(checkpointPath)).toBe(true);
  });

  it('already-complete checkpoint: no getPage calls, writes output and deletes checkpoint', async () => {
    const existingPlayers = [{ id: 99, first_name: 'LeBron', last_name: 'James' }];
    saveCheckpoint(checkpointPath, {
      players: existingPlayers,
      nextCursor: null,
    });
    const getPage = vi.fn().mockImplementation(() => {
      throw new Error('getPage should not be called');
    });
    const result = await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
    });
    expect(getPage).not.toHaveBeenCalled();
    expect(result.map).toEqual({ '99': 2544 });
    expect(result.playersCount).toBe(1);
    expect(fs.existsSync(checkpointPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(written).toEqual({ '99': 2544 });
  });

  it('empty first page: completes and writes empty map', async () => {
    const getPage = vi.fn().mockResolvedValue({
      data: [],
      nextCursor: null,
      status: 200,
    });
    const result = await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
    });
    expect(result.playersCount).toBe(0);
    expect(result.map).toEqual({});
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).toEqual({});
    expect(fs.existsSync(checkpointPath)).toBe(false);
  });

  it('throws BuildMapError when reference file is missing', async () => {
    const badRefPath = path.join(tmpDir, 'missing.json');
    const getPage = vi.fn();
    await expect(
      runBuildMap({
        getPage,
        referencePath: badRefPath,
        outputPath,
        checkpointPath,
        delayMs: 0,
        retryDelayMs: 0,
      })
    ).rejects.toThrow(BuildMapError);
    expect(getPage).not.toHaveBeenCalled();
  });

  it('throws BuildMapError when reference file has invalid JSON', async () => {
    const badRefPath = path.join(tmpDir, 'badref.json');
    fs.writeFileSync(badRefPath, 'not valid json', 'utf-8');
    const getPage = vi.fn();
    await expect(
      runBuildMap({
        getPage,
        referencePath: badRefPath,
        outputPath,
        checkpointPath,
        delayMs: 0,
        retryDelayMs: 0,
      })
    ).rejects.toThrow(BuildMapError);
    expect(getPage).not.toHaveBeenCalled();
  });

  it('returns correct unmatched in result', async () => {
    const refs: ReferenceEntry[] = [
      { first_name: 'A', last_name: 'One', nba_id: 1 },
      { first_name: 'B', last_name: 'Two', nba_id: 2 },
    ];
    fs.writeFileSync(referencePath, JSON.stringify(refs), 'utf-8');
    const getPage = vi.fn().mockResolvedValue({
      data: [{ id: 1, first_name: 'A', last_name: 'One' }],
      nextCursor: null,
      status: 200,
    });
    const result = await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
    });
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].first_name).toBe('B');
    expect(result.unmatched[0].last_name).toBe('Two');
  });

  it('calls onProgress after each page', async () => {
    const onProgress = vi.fn();
    const getPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 1, first_name: 'LeBron', last_name: 'James' }],
        nextCursor: null,
        status: 200,
      });
    await runBuildMap({
      getPage,
      referencePath,
      outputPath,
      checkpointPath,
      delayMs: 0,
      retryDelayMs: 0,
      onProgress,
    });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(1, 1);
  });
});
