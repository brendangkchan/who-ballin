import { describe, it, expect } from 'vitest';
import {
  parseFilters,
  DEFAULT_MIN_GAMES,
  DEFAULT_MIN_PTS,
  DEFAULT_MIN_MINUTES,
  MIN_MIN_GAMES,
  MIN_MIN_MINUTES,
} from './filters';

describe('parseFilters', () => {
  it('returns defaults when params are empty', () => {
    const p = new URLSearchParams();
    const filters = parseFilters(p);
    expect(filters).toEqual({
      minGames: DEFAULT_MIN_GAMES,
      minPts: DEFAULT_MIN_PTS,
      minMinutes: DEFAULT_MIN_MINUTES,
    });
  });

  it('returns defaults when params object is empty', () => {
    const filters = parseFilters({});
    expect(filters).toEqual({
      minGames: DEFAULT_MIN_GAMES,
      minPts: DEFAULT_MIN_PTS,
      minMinutes: DEFAULT_MIN_MINUTES,
    });
  });

  it('parses valid positive integers', () => {
    const p = new URLSearchParams({ minGames: '3', minPts: '25', minMinutes: '50' });
    const filters = parseFilters(p);
    expect(filters).toEqual({ minGames: 3, minPts: 25, minMinutes: 50 });
  });

  it('falls back to default for invalid values', () => {
    const p = new URLSearchParams({ minGames: 'abc', minPts: '-1', minMinutes: '' });
    const filters = parseFilters(p);
    expect(filters).toEqual({
      minGames: DEFAULT_MIN_GAMES,
      minPts: DEFAULT_MIN_PTS,
      minMinutes: DEFAULT_MIN_MINUTES,
    });
  });

  it('clamps to minimums for negative values', () => {
    const p = new URLSearchParams({ minGames: '-5', minPts: '-10', minMinutes: '-1' });
    const filters = parseFilters(p);
    expect(filters).toEqual({
      minGames: MIN_MIN_GAMES,
      minPts: DEFAULT_MIN_PTS,
      minMinutes: MIN_MIN_MINUTES,
    });
  });

  it('handles mixed valid and invalid', () => {
    const p = new URLSearchParams({ minGames: '5', minPts: 'invalid', minMinutes: '30' });
    const filters = parseFilters(p);
    expect(filters).toEqual({
      minGames: 5,
      minPts: DEFAULT_MIN_PTS,
      minMinutes: 30,
    });
  });

  it('clamps values below minimums', () => {
    const p = new URLSearchParams({ minGames: '0', minPts: '10', minMinutes: '3' });
    const filters = parseFilters(p);
    expect(filters).toEqual({
      minGames: MIN_MIN_GAMES,
      minPts: 10,
      minMinutes: MIN_MIN_MINUTES,
    });
  });

  it('handles Record with string[] (takes first element)', () => {
    const params: Record<string, string | string[]> = {
      minGames: ['4'],
      minPts: ['22'],
      minMinutes: ['60'],
    };
    const filters = parseFilters(params);
    expect(filters).toEqual({ minGames: 4, minPts: 22, minMinutes: 60 });
  });
});
