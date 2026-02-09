import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { getDb } from '../src/lib/db/client';
import teamsData from '../data/nba-teams.json';

config({ path: '.env.local' });

type TeamMeta = {
  id: number;
  abbreviation: string;
  name: string;
  conference: string;
  division: string;
};

async function main() {
  const db = getDb();
  const teams = (teamsData as { teams: TeamMeta[] }).teams;
  const teamIds = new Set(teams.map(team => team.id));

  const result = await db.execute(sql`
    select distinct team_id from (
      select home_team_id as team_id from games
      union
      select visitor_team_id as team_id from games
    ) as all_teams
    order by team_id asc
  `);

  const dbTeamIds: number[] = (result as any).rows?.map((row: any) => Number(row.team_id)) ?? [];

  const missingInJson = dbTeamIds.filter(id => !teamIds.has(id));
  const missingInDb = teams
    .map(team => team.id)
    .filter(id => !dbTeamIds.includes(id));

  console.log('teams_in_db:', dbTeamIds.length);
  console.log('teams_in_json:', teams.length);
  console.log('missing_in_json:', missingInJson);
  console.log('missing_in_db:', missingInDb);

  if (missingInJson.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('validate-team-ids failed:', error?.message ?? error);
  process.exit(1);
});
