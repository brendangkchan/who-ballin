import { describe, it, expect } from 'vitest';
import { parseMinutes, calculatePER } from './per';
import type { GameStats } from '@/types/player';

describe('parseMinutes', () => {
  it('parses MM:SS format correctly', () => {
    expect(parseMinutes('32:15')).toBe(32.25);
    expect(parseMinutes('0:30')).toBe(0.5);
    expect(parseMinutes('48:00')).toBe(48);
  });

  it('parses decimal format correctly', () => {
    expect(parseMinutes('32.5')).toBe(32.5);
    expect(parseMinutes('36')).toBe(36);
  });

  it('returns 0 for null, undefined, empty string', () => {
    expect(parseMinutes(null)).toBe(0);
    expect(parseMinutes(undefined)).toBe(0);
    expect(parseMinutes('')).toBe(0);
    expect(parseMinutes('   ')).toBe(0);
  });

  it('returns 0 for invalid input', () => {
    expect(parseMinutes('abc')).toBe(0);
    expect(parseMinutes('invalid:time')).toBe(0);
  });

  it('trims whitespace', () => {
    expect(parseMinutes('  35:00  ')).toBe(35);
  });
});

function createGameStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    id: 1,
    game: { id: 1, date: '2026-01-15' },
    player: { id: 100, first_name: 'Test', last_name: 'Player' },
    pts: 25,
    reb: 7,
    ast: 8,
    fg: 10,
    fga: 18,
    ft: 4,
    fta: 5,
    min: '35:00',
    ...overrides,
  };
}

describe('calculatePER', () => {
  it('returns 0 for empty stats', () => {
    expect(calculatePER([])).toBe(0);
  });

  it('returns 0 when total minutes is zero', () => {
    const stat = createGameStats({ min: '0:00' });
    expect(calculatePER([stat])).toBe(0);
  });

  it('returns 0 when minutes is invalid', () => {
    const stat = createGameStats({ min: '' });
    expect(calculatePER([stat])).toBe(0);
  });

  it('returns positive PER for typical stat line', () => {
    const stat = createGameStats({
      pts: 25,
      reb: 7,
      ast: 8,
      fg: 10,
      fga: 18,
      ft: 4,
      fta: 5,
      min: '35:00',
      stl: 2,
      blk: 1,
      tov: 3,
      pf: 2,
    });
    const per = calculatePER([stat]);
    expect(per).toBeGreaterThan(0);
    expect(Number.isFinite(per)).toBe(true);
  });
});
