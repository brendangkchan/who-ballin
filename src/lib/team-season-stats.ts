import type { GameRow } from '@/lib/db/schema';
import type { TeamSeedingInput } from '@/lib/seeding';
import { DIVISION_WINNER_CRITERIA, seedConference, seedTeamsWithCriteria } from '@/lib/seeding';
import teamsData from '../../data/nba-teams.json';

export type TeamMeta = {
  id: number;
  abbreviation: string;
  name: string;
  conference: string;
  division: string;
};

type TeamMetaMap = Map<number, TeamMeta>;

type HeadToHeadMap = Record<string, { wins: number; losses: number }>;

type TeamAccumulator = {
  teamId: number;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  conferenceWins: number;
  conferenceLosses: number;
  divisionWins: number;
  divisionLosses: number;
  opponents: number[];
  headToHead: HeadToHeadMap;
};

type TeamSeasonStatRow = {
  teamId: number;
  season: number;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  strengthOfSchedule: number;
  seed: number;
  updatedAt: Date;
};

type BuildStatsOptions = {
  now?: Date;
};

function winPct(wins: number, losses: number): number {
  const total = wins + losses;
  if (total <= 0) return 0;
  return wins / total;
}

function loadTeamMetaMap(): TeamMetaMap {
  const teams = (teamsData as { teams: TeamMeta[] }).teams;
  const map = new Map<number, TeamMeta>();
  for (const team of teams) {
    map.set(team.id, team);
  }
  return map;
}

function getOrCreateTeam(acc: Map<number, TeamAccumulator>, meta: TeamMeta): TeamAccumulator {
  const existing = acc.get(meta.id);
  if (existing) return existing;
  const created: TeamAccumulator = {
    teamId: meta.id,
    conference: meta.conference,
    division: meta.division,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    conferenceWins: 0,
    conferenceLosses: 0,
    divisionWins: 0,
    divisionLosses: 0,
    opponents: [],
    headToHead: {},
  };
  acc.set(meta.id, created);
  return created;
}

function updateHeadToHead(
  team: TeamAccumulator,
  opponentId: number,
  isWin: boolean
) {
  const key = String(opponentId);
  if (!team.headToHead[key]) {
    team.headToHead[key] = { wins: 0, losses: 0 };
  }
  if (isWin) team.headToHead[key].wins += 1;
  else team.headToHead[key].losses += 1;
}

function computePlayoffEligibleSets(
  teams: TeamAccumulator[]
): { east: Set<number>; west: Set<number> } {
  const byConference = new Map<string, TeamAccumulator[]>();
  for (const team of teams) {
    const list = byConference.get(team.conference) ?? [];
    list.push(team);
    byConference.set(team.conference, list);
  }

  function buildEligible(conference: string): Set<number> {
    const list = [...(byConference.get(conference) ?? [])];
    list.sort((a, b) => {
      const aPct = winPct(a.wins, a.losses);
      const bPct = winPct(b.wins, b.losses);
      if (aPct === bPct) return a.teamId - b.teamId;
      return bPct - aPct;
    });
    if (list.length === 0) return new Set();
    const index = Math.min(9, list.length - 1);
    const threshold = winPct(list[index].wins, list[index].losses);
    const eligible = new Set<number>();
    for (const team of list) {
      if (winPct(team.wins, team.losses) >= threshold) {
        eligible.add(team.teamId);
      }
    }
    return eligible;
  }

  return {
    east: buildEligible('East'),
    west: buildEligible('West'),
  };
}

function computeDivisionWinners(
  teams: TeamAccumulator[],
  seedInputs: Map<number, TeamSeedingInput>
): Set<number> {
  const byDivision = new Map<string, number[]>();
  for (const team of teams) {
    const key = `${team.conference}:${team.division}`;
    const list = byDivision.get(key) ?? [];
    list.push(team.teamId);
    byDivision.set(key, list);
  }

  const winners = new Set<number>();
  for (const teamIds of byDivision.values()) {
    const inputs = teamIds.map(id => seedInputs.get(id)).filter(Boolean) as TeamSeedingInput[];
    if (inputs.length === 0) continue;
    const result = seedTeamsWithCriteria(inputs, DIVISION_WINNER_CRITERIA);
    if (result.ordered.length > 0) {
      winners.add(Number(result.ordered[0].id));
    }
  }
  return winners;
}

export function buildTeamSeasonStats(
  season: number,
  games: GameRow[],
  options: BuildStatsOptions = {}
): TeamSeasonStatRow[] {
  const now = options.now ?? new Date();
  const teamMetaMap = loadTeamMetaMap();
  const acc = new Map<number, TeamAccumulator>();

  for (const meta of teamMetaMap.values()) {
    getOrCreateTeam(acc, meta);
  }

  for (const game of games) {
    if (game.status !== 'Final') continue;
    const homeMeta = teamMetaMap.get(game.homeTeamId);
    const awayMeta = teamMetaMap.get(game.visitorTeamId);
    if (!homeMeta || !awayMeta) {
      throw new Error(`Missing team metadata for game ${game.id}`);
    }

    const home = getOrCreateTeam(acc, homeMeta);
    const away = getOrCreateTeam(acc, awayMeta);

    const homeWin = game.homeTeamScore > game.visitorTeamScore;

    home.pointsFor += game.homeTeamScore;
    home.pointsAgainst += game.visitorTeamScore;
    away.pointsFor += game.visitorTeamScore;
    away.pointsAgainst += game.homeTeamScore;

    if (homeWin) {
      home.wins += 1;
      away.losses += 1;
    } else {
      home.losses += 1;
      away.wins += 1;
    }

    home.opponents.push(away.teamId);
    away.opponents.push(home.teamId);

    updateHeadToHead(home, away.teamId, homeWin);
    updateHeadToHead(away, home.teamId, !homeWin);

    if (home.conference === away.conference) {
      if (homeWin) {
        home.conferenceWins += 1;
        away.conferenceLosses += 1;
      } else {
        home.conferenceLosses += 1;
        away.conferenceWins += 1;
      }
    }

    if (home.division === away.division) {
      if (homeWin) {
        home.divisionWins += 1;
        away.divisionLosses += 1;
      } else {
        home.divisionLosses += 1;
        away.divisionWins += 1;
      }
    }
  }

  const teams = Array.from(acc.values());

  const eligible = computePlayoffEligibleSets(teams);
  const eastEligible = eligible.east;
  const westEligible = eligible.west;

  const seedInputs = new Map<number, TeamSeedingInput>();
  for (const team of teams) {
    const ownEligible = team.conference === 'East' ? eastEligible : westEligible;
    const otherEligible = team.conference === 'East' ? westEligible : eastEligible;

    let vsOwnWins = 0;
    let vsOwnLosses = 0;
    let vsOtherWins = 0;
    let vsOtherLosses = 0;

    for (const [opponentIdStr, record] of Object.entries(team.headToHead)) {
      const opponentId = Number(opponentIdStr);
      if (ownEligible.has(opponentId)) {
        vsOwnWins += record.wins;
        vsOwnLosses += record.losses;
      } else if (otherEligible.has(opponentId)) {
        vsOtherWins += record.wins;
        vsOtherLosses += record.losses;
      }
    }

    seedInputs.set(team.teamId, {
      id: String(team.teamId),
      conference: team.conference,
      division: team.division,
      wins: team.wins,
      losses: team.losses,
      conferenceWins: team.conferenceWins,
      conferenceLosses: team.conferenceLosses,
      divisionWins: team.divisionWins,
      divisionLosses: team.divisionLosses,
      isDivisionWinner: false,
      headToHead: team.headToHead,
      vsPlayoffEligibleOwnConfWins: vsOwnWins,
      vsPlayoffEligibleOwnConfLosses: vsOwnLosses,
      vsPlayoffEligibleOtherConfWins: vsOtherWins,
      vsPlayoffEligibleOtherConfLosses: vsOtherLosses,
      pointDifferential: team.pointsFor - team.pointsAgainst,
    });
  }

  const divisionWinners = computeDivisionWinners(teams, seedInputs);
  for (const [teamId, input] of seedInputs.entries()) {
    input.isDivisionWinner = divisionWinners.has(teamId);
  }

  const conferences = new Map<string, TeamSeedingInput[]>();
  for (const input of seedInputs.values()) {
    const list = conferences.get(input.conference) ?? [];
    list.push(input);
    conferences.set(input.conference, list);
  }

  const seeds = new Map<number, number>();
  for (const [conference, inputs] of conferences.entries()) {
    const result = seedConference(inputs);
    result.ordered.forEach((team, index) => {
      seeds.set(Number(team.id), index + 1);
    });

    if (result.unresolvedTieGroups.length > 0) {
      const ids = result.unresolvedTieGroups.flat().join(',');
      console.warn(`Unresolved tie(s) in ${conference} conference: ${ids}`);
    }
  }

  const strengthOfSchedule = new Map<number, number>();
  for (const team of teams) {
    const totalOpponents = team.opponents.length;
    if (totalOpponents === 0) {
      strengthOfSchedule.set(team.teamId, 0);
      continue;
    }
    let sum = 0;
    for (const opponentId of team.opponents) {
      const opponent = acc.get(opponentId);
      if (!opponent) continue;
      sum += winPct(opponent.wins, opponent.losses);
    }
    strengthOfSchedule.set(team.teamId, sum / totalOpponents);
  }

  return teams.map(team => {
    const winPctValue = winPct(team.wins, team.losses);
    return {
      teamId: team.teamId,
      season,
      conference: team.conference,
      division: team.division,
      wins: team.wins,
      losses: team.losses,
      winPct: winPctValue,
      pointsFor: team.pointsFor,
      pointsAgainst: team.pointsAgainst,
      pointDiff: team.pointsFor - team.pointsAgainst,
      strengthOfSchedule: strengthOfSchedule.get(team.teamId) ?? 0,
      seed: seeds.get(team.teamId) ?? 0,
      updatedAt: now,
    };
  });
}
