import { describe, expect, it } from 'vitest';
import { buildSeasonStats, buildDeltaStats } from './season-stats';

describe('buildSeasonStats', () => {
  it('computes per-game and percentages', () => {
    const row = {
      playerId: 1,
      season: 2026,
      games: 2,
      minutes: 7200, // 120 minutes
      pts: 40,
      reb: 10,
      ast: 6,
      oreb: 4,
      dreb: 6,
      stl: 2,
      blk: 1,
      turnover: 3,
      pf: 4,
      fgm: 14,
      fga: 30,
      fg3m: 4,
      fg3a: 10,
      ftm: 8,
      fta: 10,
      plusMinus: 5,
    };

    const season = buildSeasonStats(row);
    expect(season.games).toBe(2);
    expect(season.totals.minutes).toBe(120);
    expect(season.perGame.pts).toBe(20);
    expect(season.perGame.minutes).toBe(60);
    expect(season.percentages.fgPct).toBeCloseTo((14 / 30) * 100, 4);
    expect(season.percentages.fg3Pct).toBeCloseTo((4 / 10) * 100, 4);
    expect(season.percentages.ftPct).toBeCloseTo((8 / 10) * 100, 4);
  });
});

describe('buildDeltaStats', () => {
  it('computes deltas against season averages', () => {
    const season = buildSeasonStats({
      playerId: 1,
      season: 2026,
      games: 4,
      minutes: 4800, // 80 minutes
      pts: 80,
      reb: 20,
      ast: 12,
      oreb: 8,
      dreb: 12,
      stl: 4,
      blk: 2,
      turnover: 6,
      pf: 8,
      fgm: 30,
      fga: 70,
      fg3m: 8,
      fg3a: 24,
      ftm: 12,
      fta: 16,
      plusMinus: 10,
    });

    const weekly = {
      totalMinutes: 150,
      totalPts: 45,
      totalReb: 12,
      totalAst: 9,
      totalOreb: 5,
      totalDreb: 7,
      totalStl: 3,
      totalBlk: 1,
      totalTov: 4,
      totalPf: 5,
      totalFgm: 16,
      totalFga: 32,
      totalFg3m: 5,
      totalFg3a: 11,
      totalFtm: 8,
      totalFta: 9,
      plusMinus: 7,
      mpg: 50,
      pts: 22.5,
      reb: 6,
      ast: 4.5,
      oreb: 2.5,
      dreb: 3.5,
      stl: 1.5,
      blk: 0.5,
      tov: 2,
      pf: 2.5,
      fgm: 8,
      fga: 16,
      fg3m: 2.5,
      fg3a: 5.5,
      ftm: 4,
      fta: 4.5,
      ts: 60,
      fgPct: 50,
      fg3Pct: 40,
      ftPct: 88.9,
    };

    const delta = buildDeltaStats(weekly, season);
    expect(delta.totals.pts).toBe(45 - season.totals.pts);
    expect(delta.perGame.pts).toBeCloseTo(weekly.pts - season.perGame.pts, 4);
    expect(delta.percentages.fgPct).toBeCloseTo(weekly.fgPct - season.percentages.fgPct, 4);
  });
});
