import teamsData from '../../data/nba-teams.json';

export type TeamMeta = {
  id: number;
  abbreviation: string;
  name: string;
  city: string;
  nickname: string;
};

export type TeamInfo = {
  id: number;
  abbreviation: string;
  city: string;
  name: string;
};

const teams = (teamsData as { teams: TeamMeta[] }).teams;
const teamMap = new Map<number, TeamMeta>();

for (const team of teams) {
  teamMap.set(team.id, team);
}

export function getTeamMeta(teamId: number): TeamMeta | null {
  return teamMap.get(teamId) ?? null;
}

export function getTeamInfo(teamId: number): TeamInfo {
  const meta = getTeamMeta(teamId);
  if (!meta) {
    return {
      id: teamId,
      abbreviation: 'N/A',
      city: 'N/A',
      name: 'N/A',
    };
  }
  const name = meta.name || `${meta.city} ${meta.nickname}`.trim() || 'N/A';
  return {
    id: meta.id,
    abbreviation: meta.abbreviation || 'N/A',
    city: meta.city || 'N/A',
    name,
  };
}
