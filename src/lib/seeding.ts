export type HeadToHeadRecord = {
  wins: number;
  losses: number;
};

export type TeamSeedingInput = {
  id: string;
  name?: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  divisionWins?: number;
  divisionLosses?: number;
  isDivisionWinner?: boolean;
  headToHead?: Record<string, HeadToHeadRecord>;
  vsPlayoffEligibleOwnConfWins?: number;
  vsPlayoffEligibleOwnConfLosses?: number;
  vsPlayoffEligibleOtherConfWins?: number;
  vsPlayoffEligibleOtherConfLosses?: number;
  pointDifferential?: number;
};

export type SeedingResult = {
  ordered: TeamSeedingInput[];
  unresolvedTieGroups: string[][];
};

type CriterionId =
  | 'head_to_head'
  | 'division_winner'
  | 'division_win_pct'
  | 'conference_win_pct'
  | 'vs_playoff_own_conf'
  | 'vs_playoff_other_conf'
  | 'point_differential';

type SeedOptions = {
  randomDraw?: 'stable' | 'random';
};

const TWO_WAY_CRITERIA: CriterionId[] = [
  'head_to_head',
  'division_winner',
  'division_win_pct',
  'conference_win_pct',
  'vs_playoff_own_conf',
  'vs_playoff_other_conf',
  'point_differential',
];

const MULTI_WAY_CRITERIA: CriterionId[] = [
  'division_winner',
  'head_to_head',
  'division_win_pct',
  'conference_win_pct',
  'vs_playoff_own_conf',
  'vs_playoff_other_conf',
  'point_differential',
];

function winPct(wins: number, losses: number): number {
  const total = wins + losses;
  if (total <= 0) return 0;
  return wins / total;
}

function requireNumber(value: number | undefined, label: string, teamId: string): number {
  if (value == null || !Number.isFinite(value)) {
    throw new Error(`Missing required stat ${label} for team ${teamId}`);
  }
  return value;
}

function getHeadToHead(team: TeamSeedingInput, opponentId: string): HeadToHeadRecord {
  if (!team.headToHead || !team.headToHead[opponentId]) {
    return { wins: 0, losses: 0 };
  }
  return team.headToHead[opponentId];
}

function headToHeadWinPct(team: TeamSeedingInput, group: TeamSeedingInput[]): number {
  let wins = 0;
  let losses = 0;
  for (const opponent of group) {
    if (opponent.id === team.id) continue;
    const record = getHeadToHead(team, opponent.id);
    wins += record.wins;
    losses += record.losses;
  }
  return winPct(wins, losses);
}

function isSameDivision(group: TeamSeedingInput[]): boolean {
  if (group.length === 0) return false;
  const division = group[0].division;
  return group.every(team => team.division === division);
}

function allSameDivision(group: TeamSeedingInput[]): boolean {
  return isSameDivision(group);
}

function allSameDivisionTwoWay(group: TeamSeedingInput[]): boolean {
  if (group.length !== 2) return false;
  return group[0].division === group[1].division;
}

function byIdStable(a: TeamSeedingInput, b: TeamSeedingInput): number {
  return a.id.localeCompare(b.id);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function criterionValue(
  criterion: CriterionId,
  team: TeamSeedingInput,
  group: TeamSeedingInput[],
  isTwoWay: boolean
): number | null {
  switch (criterion) {
    case 'head_to_head':
      return headToHeadWinPct(team, group);
    case 'division_winner': {
      if (team.isDivisionWinner == null) {
        throw new Error(`Missing isDivisionWinner for team ${team.id}`);
      }
      return team.isDivisionWinner ? 1 : 0;
    }
    case 'division_win_pct': {
      if (isTwoWay) {
        if (!allSameDivisionTwoWay(group)) return null;
      } else if (!allSameDivision(group)) {
        return null;
      }
      const wins = requireNumber(team.divisionWins, 'divisionWins', team.id);
      const losses = requireNumber(team.divisionLosses, 'divisionLosses', team.id);
      return winPct(wins, losses);
    }
    case 'conference_win_pct': {
      const wins = requireNumber(team.conferenceWins, 'conferenceWins', team.id);
      const losses = requireNumber(team.conferenceLosses, 'conferenceLosses', team.id);
      return winPct(wins, losses);
    }
    case 'vs_playoff_own_conf': {
      const wins = requireNumber(
        team.vsPlayoffEligibleOwnConfWins,
        'vsPlayoffEligibleOwnConfWins',
        team.id
      );
      const losses = requireNumber(
        team.vsPlayoffEligibleOwnConfLosses,
        'vsPlayoffEligibleOwnConfLosses',
        team.id
      );
      return winPct(wins, losses);
    }
    case 'vs_playoff_other_conf': {
      const wins = requireNumber(
        team.vsPlayoffEligibleOtherConfWins,
        'vsPlayoffEligibleOtherConfWins',
        team.id
      );
      const losses = requireNumber(
        team.vsPlayoffEligibleOtherConfLosses,
        'vsPlayoffEligibleOtherConfLosses',
        team.id
      );
      return winPct(wins, losses);
    }
    case 'point_differential': {
      return requireNumber(team.pointDifferential, 'pointDifferential', team.id);
    }
    default:
      return null;
  }
}

function splitByValue(
  group: TeamSeedingInput[],
  values: Map<string, number>
): TeamSeedingInput[][] {
  const sorted = [...group].sort((a, b) => {
    const aValue = values.get(a.id) ?? 0;
    const bValue = values.get(b.id) ?? 0;
    if (aValue === bValue) return byIdStable(a, b);
    return bValue - aValue;
  });

  const tiers: TeamSeedingInput[][] = [];
  for (const team of sorted) {
    const value = values.get(team.id) ?? 0;
    const lastTier = tiers[tiers.length - 1];
    if (!lastTier) {
      tiers.push([team]);
      continue;
    }
    const lastValue = values.get(lastTier[0].id) ?? 0;
    if (value === lastValue) {
      lastTier.push(team);
    } else {
      tiers.push([team]);
    }
  }

  return tiers;
}

function resolveTieGroup(
  group: TeamSeedingInput[],
  criteria: CriterionId[],
  options: SeedOptions,
  unresolvedTieGroups: string[][]
): TeamSeedingInput[] {
  const isTwoWay = group.length === 2;

  for (const criterion of criteria) {
    const values = new Map<string, number>();
    for (const team of group) {
      const value = criterionValue(criterion, team, group, isTwoWay);
      if (value == null) {
        values.clear();
        break;
      }
      values.set(team.id, value);
    }

    if (values.size === 0) continue;

    const uniqueValues = new Set(values.values());
    if (uniqueValues.size === 1) continue;

    const tiers = splitByValue(group, values);

    if (tiers.length === group.length) {
      return tiers.flat();
    }

    const ordered: TeamSeedingInput[] = [];
    for (const tier of tiers) {
      if (tier.length === 1) {
        ordered.push(tier[0]);
      } else {
        ordered.push(...resolveTieGroup(tier, criteria, options, unresolvedTieGroups));
      }
    }

    return ordered;
  }

  const unresolvedIds = group.map(team => team.id);
  unresolvedTieGroups.push(unresolvedIds);

  if (options.randomDraw === 'random') {
    return shuffle(group);
  }

  return [...group].sort(byIdStable);
}

function winPctKey(team: TeamSeedingInput): string {
  const pct = winPct(team.wins, team.losses);
  return pct.toFixed(6);
}

export function seedTeamsWithCriteria(
  teams: TeamSeedingInput[],
  criteria: CriterionId[],
  options: SeedOptions = {}
): SeedingResult {
  if (teams.length <= 1) {
    return { ordered: [...teams], unresolvedTieGroups: [] };
  }

  const sorted = [...teams].sort((a, b) => {
    const aPct = winPct(a.wins, a.losses);
    const bPct = winPct(b.wins, b.losses);
    if (aPct === bPct) return byIdStable(a, b);
    return bPct - aPct;
  });

  const groups = new Map<string, TeamSeedingInput[]>();
  for (const team of sorted) {
    const key = winPctKey(team);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(team);
  }

  const ordered: TeamSeedingInput[] = [];
  const unresolvedTieGroups: string[][] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      ordered.push(group[0]);
      continue;
    }
    ordered.push(...resolveTieGroup(group, criteria, options, unresolvedTieGroups));
  }

  return { ordered, unresolvedTieGroups };
}

export function seedConference(
  teams: TeamSeedingInput[],
  options: SeedOptions = {}
): SeedingResult {
  if (teams.length <= 1) {
    return { ordered: [...teams], unresolvedTieGroups: [] };
  }

  const sorted = [...teams].sort((a, b) => {
    const aPct = winPct(a.wins, a.losses);
    const bPct = winPct(b.wins, b.losses);
    if (aPct === bPct) return byIdStable(a, b);
    return bPct - aPct;
  });

  const groups = new Map<string, TeamSeedingInput[]>();
  for (const team of sorted) {
    const key = winPctKey(team);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(team);
  }

  const ordered: TeamSeedingInput[] = [];
  const unresolvedTieGroups: string[][] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      ordered.push(group[0]);
      continue;
    }
    const criteria = group.length === 2 ? TWO_WAY_CRITERIA : MULTI_WAY_CRITERIA;
    ordered.push(...resolveTieGroup(group, criteria, options, unresolvedTieGroups));
  }

  return { ordered, unresolvedTieGroups };
}

export const DIVISION_WINNER_CRITERIA: CriterionId[] = [
  'head_to_head',
  'division_win_pct',
  'conference_win_pct',
  'vs_playoff_own_conf',
  'vs_playoff_other_conf',
  'point_differential',
];
