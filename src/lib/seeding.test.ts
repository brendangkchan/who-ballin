import { describe, expect, it } from 'vitest';
import type { TeamSeedingInput } from './seeding';
import { seedConference } from './seeding';

function baseTeam(overrides: Partial<TeamSeedingInput>): TeamSeedingInput {
  return {
    id: 'T',
    conference: 'E',
    division: 'Atlantic',
    wins: 40,
    losses: 30,
    conferenceWins: 24,
    conferenceLosses: 26,
    isDivisionWinner: false,
    headToHead: {},
    ...overrides,
  };
}

describe('seedConference', () => {
  it('breaks a two-way tie by head-to-head record', () => {
    const teamA = baseTeam({
      id: 'A',
      headToHead: {
        B: { wins: 3, losses: 1 },
      },
    });

    const teamB = baseTeam({
      id: 'B',
      headToHead: {
        A: { wins: 1, losses: 3 },
      },
    });

    const result = seedConference([teamA, teamB]);
    expect(result.ordered.map(team => team.id)).toEqual(['A', 'B']);
    expect(result.unresolvedTieGroups).toEqual([]);
  });

  it('uses division winner when head-to-head is tied', () => {
    const teamA = baseTeam({
      id: 'A',
      isDivisionWinner: false,
      headToHead: {
        B: { wins: 2, losses: 2 },
      },
    });

    const teamB = baseTeam({
      id: 'B',
      isDivisionWinner: true,
      headToHead: {
        A: { wins: 2, losses: 2 },
      },
    });

    const result = seedConference([teamA, teamB]);
    expect(result.ordered.map(team => team.id)).toEqual(['B', 'A']);
    expect(result.unresolvedTieGroups).toEqual([]);
  });

  it('restarts criteria after a partial break in multi-way ties', () => {
    const teamA = baseTeam({
      id: 'A',
      division: 'Atlantic',
      headToHead: {
        B: { wins: 3, losses: 1 },
        C: { wins: 1, losses: 1 },
      },
      conferenceWins: 25,
      conferenceLosses: 25,
    });

    const teamB = baseTeam({
      id: 'B',
      division: 'Atlantic',
      headToHead: {
        A: { wins: 1, losses: 3 },
        C: { wins: 1, losses: 1 },
      },
      conferenceWins: 26,
      conferenceLosses: 24,
    });

    const teamC = baseTeam({
      id: 'C',
      division: 'Central',
      headToHead: {
        A: { wins: 1, losses: 1 },
        B: { wins: 1, losses: 1 },
      },
      conferenceWins: 24,
      conferenceLosses: 26,
    });

    const result = seedConference([teamA, teamB, teamC]);
    expect(result.ordered.map(team => team.id)).toEqual(['A', 'C', 'B']);
    expect(result.unresolvedTieGroups).toEqual([]);
  });

  it('resolves multi-way ties using division winner before other criteria', () => {
    const teamA = baseTeam({
      id: 'A',
      division: 'Atlantic',
      isDivisionWinner: true,
      headToHead: {
        B: { wins: 0, losses: 4 },
        C: { wins: 2, losses: 2 },
      },
      conferenceWins: 25,
      conferenceLosses: 25,
    });

    const teamB = baseTeam({
      id: 'B',
      division: 'Central',
      isDivisionWinner: false,
      headToHead: {
        A: { wins: 4, losses: 0 },
        C: { wins: 2, losses: 2 },
      },
      conferenceWins: 24,
      conferenceLosses: 26,
    });

    const teamC = baseTeam({
      id: 'C',
      division: 'Southeast',
      isDivisionWinner: false,
      headToHead: {
        A: { wins: 2, losses: 2 },
        B: { wins: 2, losses: 2 },
      },
      conferenceWins: 26,
      conferenceLosses: 24,
    });

    const result = seedConference([teamA, teamB, teamC]);
    expect(result.ordered.map(team => team.id)).toEqual(['A', 'C', 'B']);
    expect(result.unresolvedTieGroups).toEqual([]);
  });
});
