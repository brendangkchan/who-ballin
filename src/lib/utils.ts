import type { GameStats, Game, GameResult, PlayerWeekStats } from '@/types/player';
import { calculatePER, parseMinutes } from './per';
import idMap from './nba-player-id-map.json';

const NBA_HEADSHOT_BASE = 'https://cdn.nba.com/headshots/nba/latest/1040x760';
const NBA_PROFILE_BASE = 'https://www.nba.com/player';

export function getPlayerImageUrl(playerId: number): string {
  const nbaId = idMap[String(playerId)];
  const id = nbaId != null ? nbaId : playerId;
  return `${NBA_HEADSHOT_BASE}/${id}.png`;
}

export function getPlayerProfileUrl(playerId: number): string {
  const nbaId = idMap[String(playerId)];
  const id = nbaId != null ? nbaId : playerId;
  return `${NBA_PROFILE_BASE}/${id}`;
}

export function calculateTrueShooting(stats: GameStats[]): number {
  if (stats.length === 0) return 0;

  const totals = stats.reduce(
    (acc, stat) => ({
      pts: acc.pts + stat.pts,
      fga: acc.fga + stat.fga,
      fta: acc.fta + stat.fta,
    }),
    { pts: 0, fga: 0, fta: 0 }
  );

  if (totals.fga + totals.fta === 0) return 0;

  const ts = totals.pts / (2 * (totals.fga + 0.44 * totals.fta));
  return ts * 100; // return as percentage
}

export function calculateGameResult(
  stat: GameStats,
  game: Game,
  playerTeamId: number
): GameResult {
  const isHome = game.home_team.id === playerTeamId;
  const playerTeamScore = isHome ? game.home_team_score : game.visitor_team_score;
  const opponentScore = isHome ? game.visitor_team_score : game.home_team_score;
  const opponent = isHome ? game.visitor_team : game.home_team;
  const result = playerTeamScore > opponentScore ? "W" : "L";

  return {
    date: game.date,
    opponent: {
      id: opponent.id,
      abbreviation: opponent.abbreviation,
      city: opponent.city,
      name: opponent.name,
    },
    homeScore: game.home_team_score,
    awayScore: game.visitor_team_score,
    playerTeamScore,
    opponentScore,
    result,
    isHome,
  };
}

export function aggregatePlayerStats(
  stats: GameStats[],
  games: Game[]
): PlayerWeekStats {
  const gamesPlayed = stats.length;

  if (gamesPlayed === 0) {
    throw new Error('Cannot aggregate stats for player with no games');
  }

  // Simple averages
  const avgPts = stats.reduce((sum, s) => sum + s.pts, 0) / gamesPlayed;
  const avgReb = stats.reduce((sum, s) => sum + s.reb, 0) / gamesPlayed;
  const avgAst = stats.reduce((sum, s) => sum + s.ast, 0) / gamesPlayed;

  // Cumulative calculations
  const totalPts = stats.reduce((sum, s) => sum + s.pts, 0);
  const totalFga = stats.reduce((sum, s) => sum + s.fga, 0);
  const totalFta = stats.reduce((sum, s) => sum + s.fta, 0);
  const ts = calculateTrueShooting(stats);

  const plusMinus = stats.reduce((sum, s) => sum + (s.plus_minus || 0), 0);
  const totalMinutes = stats.reduce((sum, s) => sum + parseMinutes(s.min), 0);

  // PER calculation (uses cumulative totals)
  const rawPer = calculatePER(stats);
  const per = Number.isFinite(rawPer) ? rawPer : 0;

  // Match games for win/loss
  const gameResults = stats
    .map(stat => {
      const game = games.find(g => g.id === stat.game.id);
      if (!game) return null;
      return calculateGameResult(stat, game, stat.player.team?.id ?? stat.team?.id ?? 0);
    })
    .filter((result): result is GameResult => result !== null);

  // Use team from most recent game (player may have been traded mid-week)
  const statsByDate = [...stats].sort((a, b) =>
    new Date(b.game.date).getTime() - new Date(a.game.date).getTime()
  );
  const mostRecentStat = statsByDate[0];
  const basePlayer = mostRecentStat.player;
  const statTeam = mostRecentStat.team;

  return {
    player: statTeam
      ? { ...basePlayer, team: { id: statTeam.id, abbreviation: statTeam.abbreviation, city: statTeam.city, name: statTeam.name } }
      : basePlayer,
    games: gamesPlayed,
    totalMinutes,
    totalPts,
    per,
    pts: avgPts,
    reb: avgReb,
    ast: avgAst,
    ts,
    plusMinus,
    imageUrl: getPlayerImageUrl(basePlayer.id),
    profileUrl: getPlayerProfileUrl(basePlayer.id),
    gameResults,
  };
}
