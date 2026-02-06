import { describe, it, expect } from 'vitest';
import {
  calculateGameResult,
  aggregatePlayerStats,
  calculateTrueShooting,
} from './utils';
import type { Game, GameStats } from '@/types/player';

function createGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    date: '2026-01-15',
    season: 2025,
    status: 'Final',
    home_team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
    visitor_team: { id: 2, abbreviation: 'BOS', city: 'Boston', name: 'Celtics' },
    home_team_score: 110,
    visitor_team_score: 105,
    ...overrides,
  };
}

function createGameStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    id: 1,
    game: { id: 1, date: '2026-01-15' },
    player: { id: 100, first_name: 'LeBron', last_name: 'James' },
    team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
    pts: 25,
    reb: 7,
    ast: 8,
    fg: 10,
    fga: 18,
    ft: 4,
    fta: 5,
    min: '35:00',
    plus_minus: 5,
    ...overrides,
  };
}

describe('calculateGameResult', () => {
  it('returns home win when player team is home and wins', () => {
    const game = createGame({ home_team_score: 110, visitor_team_score: 105 });
    const stat = createGameStats({ team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' } });
    const result = calculateGameResult(stat, game, 1);
    expect(result.result).toBe('W');
    expect(result.isHome).toBe(true);
    expect(result.playerTeamScore).toBe(110);
    expect(result.opponentScore).toBe(105);
    expect(result.opponent.name).toBe('Celtics');
  });

  it('returns away loss when player team is visitor and loses', () => {
    const game = createGame({ home_team_score: 110, visitor_team_score: 105 });
    const stat = createGameStats({ team: { id: 2, abbreviation: 'BOS', city: 'Boston', name: 'Celtics' } });
    const result = calculateGameResult(stat, game, 2);
    expect(result.result).toBe('L');
    expect(result.isHome).toBe(false);
    expect(result.playerTeamScore).toBe(105);
    expect(result.opponentScore).toBe(110);
    expect(result.opponent.name).toBe('Lakers');
  });

  it('sets comebackInfo when win with qualifying deficit (down 22 after Q1)', () => {
    const game = createGame({
      home_team_score: 110,
      visitor_team_score: 105,
      home_q1: 15,
      home_q2: 30,
      home_q3: 75,
      home_q4: 35,
      visitor_q1: 37,
      visitor_q2: 25,
      visitor_q3: 25,
      visitor_q4: 18,
    });
    const stat = createGameStats({ team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' } });
    const result = calculateGameResult(stat, game, 1);
    expect(result.result).toBe('W');
    expect(result.comebackInfo).toEqual({ deficit: 22, afterQuarters: 1 });
  });

  it('sets no comebackInfo when loss even with qualifying deficit', () => {
    const game = createGame({
      home_team_score: 95,
      visitor_team_score: 110,
      home_q1: 15,
      home_q2: 30,
      home_q3: 60,
      home_q4: 35,
      visitor_q1: 37,
      visitor_q2: 35,
      visitor_q3: 20,
      visitor_q4: 18,
    });
    const stat = createGameStats({ team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' } });
    const result = calculateGameResult(stat, game, 1);
    expect(result.result).toBe('L');
    expect(result.comebackInfo).toBeUndefined();
  });

  it('sets no comebackInfo when deficit below threshold', () => {
    const game = createGame({
      home_team_score: 110,
      visitor_team_score: 105,
      home_q1: 25,
      home_q2: 50,
      home_q3: 75,
      home_q4: 35,
      visitor_q1: 30,
      visitor_q2: 25,
      visitor_q3: 25,
      visitor_q4: 25,
    });
    const stat = createGameStats({ team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' } });
    const result = calculateGameResult(stat, game, 1);
    expect(result.result).toBe('W');
    expect(result.comebackInfo).toBeUndefined();
  });

  it('sets no comebackInfo when quarter data missing', () => {
    const game = createGame({ home_team_score: 110, visitor_team_score: 105 });
    const stat = createGameStats({ team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' } });
    const result = calculateGameResult(stat, game, 1);
    expect(result.result).toBe('W');
    expect(result.comebackInfo).toBeUndefined();
  });

  it('picks largest qualifying deficit when multiple quarters qualify', () => {
    const game = createGame({
      home_team_score: 115,
      visitor_team_score: 110,
      home_q1: 10,
      home_q2: 25,
      home_q3: 50,
      home_q4: 30,
      visitor_q1: 35,
      visitor_q2: 35,
      visitor_q3: 25,
      visitor_q4: 15,
    });
    const stat = createGameStats({ team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' } });
    const result = calculateGameResult(stat, game, 1);
    expect(result.result).toBe('W');
    expect(result.comebackInfo?.deficit).toBe(35);
    expect(result.comebackInfo?.afterQuarters).toBe(2);
  });
});

describe('aggregatePlayerStats', () => {
  it('throws when stats empty', () => {
    expect(() => aggregatePlayerStats([], [])).toThrow('Cannot aggregate stats for player with no games');
  });

  it('returns correct averages and totals', () => {
    const game = createGame({ id: 1 });
    const stat1 = createGameStats({
      id: 1,
      game: { id: 1, date: '2026-01-15' },
      pts: 20,
      reb: 5,
      ast: 6,
      min: '30:00',
      plus_minus: 10,
    });
    const stat2 = createGameStats({
      id: 2,
      game: { id: 1, date: '2026-01-15' },
      pts: 30,
      reb: 9,
      ast: 10,
      min: '38:00',
      plus_minus: 8,
    });
    const result = aggregatePlayerStats([stat1, stat2], [game, game]);
    expect(result.games).toBe(2);
    expect(result.pts).toBe(25);
    expect(result.reb).toBe(7);
    expect(result.ast).toBe(8);
    expect(result.totalPts).toBe(50);
    expect(result.totalMinutes).toBe(68);
    expect(result.plusMinus).toBe(18);
    expect(result.per).toBeGreaterThan(0);
  });

  it('matches stats to games by id and builds gameResults', () => {
    const game1 = createGame({ id: 1, home_team_score: 110, visitor_team_score: 105 });
    const game2 = createGame({ id: 2, home_team_score: 90, visitor_team_score: 100 });
    const stat1 = createGameStats({
      id: 1,
      game: { id: 1, date: '2026-01-15' },
      team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
    });
    const stat2 = createGameStats({
      id: 2,
      game: { id: 2, date: '2026-01-16' },
      team: { id: 1, abbreviation: 'LAL', city: 'Los Angeles', name: 'Lakers' },
    });
    const result = aggregatePlayerStats([stat1, stat2], [game1, game2]);
    expect(result.gameResults).toHaveLength(2);
    expect(result.gameResults[0].result).toBe('W');
    expect(result.gameResults[0].opponent.name).toBe('Celtics');
    expect(result.gameResults[1].result).toBe('L');
    expect(result.gameResults[1].opponent.name).toBe('Celtics');
  });

  it('excludes gameResults when game not found in games array', () => {
    const game = createGame({ id: 1 });
    const stat1 = createGameStats({ id: 1, game: { id: 1, date: '2026-01-15' } });
    const stat2 = createGameStats({ id: 2, game: { id: 999, date: '2026-01-16' } });
    const result = aggregatePlayerStats([stat1, stat2], [game]);
    expect(result.gameResults).toHaveLength(1);
    expect(result.games).toBe(2);
  });
});

describe('calculateTrueShooting', () => {
  it('returns 0 for empty stats', () => {
    expect(calculateTrueShooting([])).toBe(0);
  });

  it('returns 0 when zero attempts', () => {
    const stat = createGameStats({ pts: 0, fga: 0, fta: 0 });
    expect(calculateTrueShooting([stat])).toBe(0);
  });

  it('returns correct TS% for simple input', () => {
    const stat = createGameStats({ pts: 30, fga: 20, fta: 10 });
    const ts = calculateTrueShooting([stat]);
    expect(ts).toBeGreaterThan(0);
    expect(ts).toBeLessThan(100);
    const expected = (30 / (2 * (20 + 0.44 * 10))) * 100;
    expect(ts).toBeCloseTo(expected, 2);
  });
});
