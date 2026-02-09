import { describe, expect, it } from 'vitest';
import { buildTeamSeasonStats } from './team-season-stats';
import type { GameRow } from '@/lib/db/schema';

function createGame(overrides: Partial<GameRow>): GameRow {
  return {
    id: overrides.id ?? 1,
    date: overrides.date ?? new Date('2025-01-01T00:00:00Z'),
    season: overrides.season ?? 2025,
    status: overrides.status ?? 'Final',
    homeTeamId: overrides.homeTeamId ?? 2,
    visitorTeamId: overrides.visitorTeamId ?? 20,
    homeTeamScore: overrides.homeTeamScore ?? 100,
    visitorTeamScore: overrides.visitorTeamScore ?? 90,
  };
}

describe('buildTeamSeasonStats', () => {
  it('computes record, win%, point diff, SOS, and seed by conference', () => {
    const games: GameRow[] = [
      createGame({
        id: 1,
        homeTeamId: 2, // BOS
        visitorTeamId: 20, // NYK
        homeTeamScore: 110,
        visitorTeamScore: 100,
      }),
      createGame({
        id: 2,
        homeTeamId: 20, // NYK
        visitorTeamId: 2, // BOS
        homeTeamScore: 99,
        visitorTeamScore: 101,
      }),
      createGame({
        id: 3,
        homeTeamId: 14, // LAL
        visitorTeamId: 10, // GSW
        homeTeamScore: 120,
        visitorTeamScore: 110,
      }),
    ];

    const stats = buildTeamSeasonStats(2025, games, { now: new Date('2025-02-01T00:00:00Z') });
    const byId = new Map(stats.map(row => [row.teamId, row]));

    const bos = byId.get(2)!;
    const nyk = byId.get(20)!;
    const lal = byId.get(14)!;
    const gsw = byId.get(10)!;

    expect(bos.wins).toBe(2);
    expect(bos.losses).toBe(0);
    expect(bos.winPct).toBe(1);
    expect(bos.pointsFor).toBe(211);
    expect(bos.pointsAgainst).toBe(199);
    expect(bos.pointDiff).toBe(12);
    expect(bos.seed).toBe(1);
    expect(bos.strengthOfSchedule).toBe(0);

    expect(nyk.wins).toBe(0);
    expect(nyk.losses).toBe(2);
    expect(nyk.winPct).toBe(0);
    expect(nyk.seed).toBeGreaterThan(1);
    expect(nyk.strengthOfSchedule).toBe(1);

    expect(lal.wins).toBe(1);
    expect(lal.losses).toBe(0);
    expect(lal.seed).toBe(1);

    expect(gsw.wins).toBe(0);
    expect(gsw.losses).toBe(1);
    expect(gsw.seed).toBeGreaterThan(1);
  });

  it('ignores games that are not Final', () => {
    const games: GameRow[] = [
      createGame({
        id: 1,
        status: 'Final',
        homeTeamId: 2, // BOS
        visitorTeamId: 20, // NYK
        homeTeamScore: 110,
        visitorTeamScore: 100,
      }),
      createGame({
        id: 2,
        status: 'In Progress',
        homeTeamId: 20, // NYK
        visitorTeamId: 2, // BOS
        homeTeamScore: 999,
        visitorTeamScore: 0,
      }),
    ];

    const stats = buildTeamSeasonStats(2025, games, { now: new Date('2025-02-01T00:00:00Z') });
    const byId = new Map(stats.map(row => [row.teamId, row]));

    const bos = byId.get(2)!;
    const nyk = byId.get(20)!;

    expect(bos.wins).toBe(1);
    expect(bos.losses).toBe(0);
    expect(bos.pointsFor).toBe(110);
    expect(bos.pointsAgainst).toBe(100);

    expect(nyk.wins).toBe(0);
    expect(nyk.losses).toBe(1);
    expect(nyk.pointsFor).toBe(100);
    expect(nyk.pointsAgainst).toBe(110);
  });

  it('weights SOS by games played against opponents', () => {
    const games: GameRow[] = [
      createGame({
        id: 1,
        homeTeamId: 2, // BOS
        visitorTeamId: 20, // NYK
        homeTeamScore: 110,
        visitorTeamScore: 100,
      }),
      createGame({
        id: 2,
        homeTeamId: 2, // BOS
        visitorTeamId: 20, // NYK
        homeTeamScore: 120,
        visitorTeamScore: 110,
      }),
      createGame({
        id: 3,
        homeTeamId: 2, // BOS
        visitorTeamId: 1, // ATL
        homeTeamScore: 90,
        visitorTeamScore: 100,
      }),
    ];

    const stats = buildTeamSeasonStats(2025, games, { now: new Date('2025-02-01T00:00:00Z') });
    const byId = new Map(stats.map(row => [row.teamId, row]));

    const bos = byId.get(2)!;
    const nyk = byId.get(20)!;
    const atl = byId.get(1)!;

    expect(nyk.wins).toBe(0);
    expect(nyk.losses).toBe(2);
    expect(atl.wins).toBe(1);
    expect(atl.losses).toBe(0);

    const expectedSOS = (0 + 0 + 1) / 3;
    expect(bos.strengthOfSchedule).toBeCloseTo(expectedSOS, 6);
  });

  it('includes teams with zero games', () => {
    const stats = buildTeamSeasonStats(2025, [], { now: new Date('2025-02-01T00:00:00Z') });
    expect(stats.length).toBe(30);
    const sample = stats.find(row => row.teamId === 2);
    expect(sample).toBeTruthy();
    if (!sample) return;
    expect(sample.wins).toBe(0);
    expect(sample.losses).toBe(0);
  });
});
