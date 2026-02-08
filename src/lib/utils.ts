import { differenceInDays, startOfDay } from 'date-fns';
import type { GameStats, Game, GameResult, PlayerWeekStats } from '@/types/player';
import { calculatePER, parseMinutes } from './per';
import idMapData from './nba-player-id-map.json';
const idMap = idMapData as Record<string, number>;

const NBA_HEADSHOT_BASE = 'https://cdn.nba.com/headshots/nba/latest/1040x760';
const NBA_PROFILE_BASE = 'https://www.nba.com/player';

/**
 * Returns "today", "yesterday", or "N days ago" for an ISO date string.
 * @param isoString - ISO 8601 date string (e.g. from API generatedAt)
 * @param now - Optional reference time for testing; defaults to current date
 */
export function formatLastUpdated(isoString: string, now?: Date): string {
  if (isoString == null || String(isoString).trim() === '') return 'unknown';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const ref = now ?? new Date();
  const refStart = startOfDay(ref);
  const dateStart = startOfDay(date);
  const days = differenceInDays(refStart, dateStart);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function getNbaPlayerId(playerId: number): number {
  return idMap[String(playerId)] ?? playerId;
}

export function getPlayerImageUrl(playerId: number): string {
  const id = getNbaPlayerId(playerId);
  return `${NBA_HEADSHOT_BASE}/${id}.png`;
}

export function getPlayerProfileUrl(playerId: number): string {
  const id = getNbaPlayerId(playerId);
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

/** Comeback thresholds: deficit > X after N quarters */
const COMEBACK_THRESHOLDS = [
  { afterQuarters: 1, minDeficit: 20 },
  { afterQuarters: 2, minDeficit: 15 },
  { afterQuarters: 3, minDeficit: 10 },
] as const;

/** Returns deficits at end of Q1, Q2, Q3 (and Q4 if available), or null if no quarter data */
function getDeficitsByQuarter(game: Game, isHome: boolean): number[] | null {
  const h1 = game.home_q1, h2 = game.home_q2, h3 = game.home_q3, h4 = game.home_q4;
  const v1 = game.visitor_q1, v2 = game.visitor_q2, v3 = game.visitor_q3, v4 = game.visitor_q4;

  if (
    typeof h1 !== "number" || typeof h2 !== "number" || typeof h3 !== "number" ||
    typeof v1 !== "number" || typeof v2 !== "number" || typeof v3 !== "number"
  ) {
    return null;
  }

  const homeAfterQ1 = h1, homeAfterQ2 = h1 + h2, homeAfterQ3 = h1 + h2 + h3;
  const visitorAfterQ1 = v1, visitorAfterQ2 = v1 + v2, visitorAfterQ3 = v1 + v2 + v3;

  const playerAfterQ1 = isHome ? homeAfterQ1 : visitorAfterQ1;
  const playerAfterQ2 = isHome ? homeAfterQ2 : visitorAfterQ2;
  const playerAfterQ3 = isHome ? homeAfterQ3 : visitorAfterQ3;

  const oppAfterQ1 = isHome ? visitorAfterQ1 : homeAfterQ1;
  const oppAfterQ2 = isHome ? visitorAfterQ2 : homeAfterQ2;
  const oppAfterQ3 = isHome ? visitorAfterQ3 : homeAfterQ3;

  const deficitQ1 = Math.max(0, oppAfterQ1 - playerAfterQ1);
  const deficitQ2 = Math.max(0, oppAfterQ2 - playerAfterQ2);
  const deficitQ3 = Math.max(0, oppAfterQ3 - playerAfterQ3);

  const deficits = [deficitQ1, deficitQ2, deficitQ3];
  if (typeof h4 === "number" && typeof v4 === "number") {
    const homeAfterQ4 = homeAfterQ3 + h4;
    const visitorAfterQ4 = visitorAfterQ3 + v4;
    const playerAfterQ4 = isHome ? homeAfterQ4 : visitorAfterQ4;
    const oppAfterQ4 = isHome ? visitorAfterQ4 : homeAfterQ4;
    deficits.push(Math.max(0, oppAfterQ4 - playerAfterQ4));
  }
  return deficits;
}

function getComebackInfo(
  game: Game,
  isHome: boolean,
  result: "W" | "L"
): { deficit: number; afterQuarters: number } | null {
  if (result !== "W") return null;

  const deficits = getDeficitsByQuarter(game, isHome);
  if (!deficits || deficits.length < 3) return null;

  const candidates: { deficit: number; afterQuarters: number }[] = [];

  for (const { afterQuarters, minDeficit } of COMEBACK_THRESHOLDS) {
    const deficit = deficits[afterQuarters - 1];
    if (deficit > minDeficit) {
      candidates.push({ deficit, afterQuarters });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.deficit - a.deficit || a.afterQuarters - b.afterQuarters);
  return candidates[0];
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

  const comebackInfo = getComebackInfo(game, isHome, result);

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
    comebackInfo: comebackInfo ?? undefined,
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

  const totals = stats.reduce(
    (acc, s) => {
      const fgm = (s as any).fgm ?? (s as any).fg ?? 0;
      const fg3m = (s as any).fg3m ?? (s as any).fg3 ?? 0;
      const ftm = (s as any).ftm ?? (s as any).ft ?? 0;
      const tov = (s as any).turnover ?? (s as any).tov ?? 0;
      return {
        pts: acc.pts + s.pts,
        reb: acc.reb + s.reb,
        ast: acc.ast + s.ast,
        oreb: acc.oreb + (s.oreb ?? 0),
        dreb: acc.dreb + (s.dreb ?? 0),
        stl: acc.stl + (s.stl ?? 0),
        blk: acc.blk + (s.blk ?? 0),
        tov: acc.tov + tov,
        pf: acc.pf + (s.pf ?? 0),
        fgm: acc.fgm + fgm,
        fga: acc.fga + s.fga,
        fg3m: acc.fg3m + fg3m,
        fg3a: acc.fg3a + (s.fg3a ?? 0),
        ftm: acc.ftm + ftm,
        fta: acc.fta + s.fta,
      };
    },
    {
      pts: 0,
      reb: 0,
      ast: 0,
      oreb: 0,
      dreb: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pf: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
    }
  );

  // Simple averages
  const avgPts = totals.pts / gamesPlayed;
  const avgReb = totals.reb / gamesPlayed;
  const avgAst = totals.ast / gamesPlayed;
  const avgOreb = totals.oreb / gamesPlayed;
  const avgDreb = totals.dreb / gamesPlayed;
  const avgStl = totals.stl / gamesPlayed;
  const avgBlk = totals.blk / gamesPlayed;
  const avgTov = totals.tov / gamesPlayed;
  const avgPf = totals.pf / gamesPlayed;
  const avgFgm = totals.fgm / gamesPlayed;
  const avgFga = totals.fga / gamesPlayed;
  const avgFg3m = totals.fg3m / gamesPlayed;
  const avgFg3a = totals.fg3a / gamesPlayed;
  const avgFtm = totals.ftm / gamesPlayed;
  const avgFta = totals.fta / gamesPlayed;

  // Cumulative calculations
  const totalPts = totals.pts;
  const totalFga = totals.fga;
  const totalFta = totals.fta;
  const ts = calculateTrueShooting(stats);

  const plusMinus = stats.reduce((sum, s) => sum + (s.plus_minus || 0), 0);
  const totalMinutes = stats.reduce((sum, s) => sum + parseMinutes(s.min), 0);
  const fgPct = totalFga > 0 ? (totals.fgm / totalFga) * 100 : 0;
  const fg3Pct = totals.fg3a > 0 ? (totals.fg3m / totals.fg3a) * 100 : 0;
  const ftPct = totalFta > 0 ? (totals.ftm / totalFta) * 100 : 0;
  const mpg = gamesPlayed > 0 ? totalMinutes / gamesPlayed : 0;

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
    totalReb: totals.reb,
    totalAst: totals.ast,
    totalOreb: totals.oreb,
    totalDreb: totals.dreb,
    totalStl: totals.stl,
    totalBlk: totals.blk,
    totalTov: totals.tov,
    totalPf: totals.pf,
    totalFgm: totals.fgm,
    totalFga: totals.fga,
    totalFg3m: totals.fg3m,
    totalFg3a: totals.fg3a,
    totalFtm: totals.ftm,
    totalFta: totals.fta,
    per,
    pts: avgPts,
    reb: avgReb,
    ast: avgAst,
    oreb: avgOreb,
    dreb: avgDreb,
    stl: avgStl,
    blk: avgBlk,
    tov: avgTov,
    pf: avgPf,
    fgm: avgFgm,
    fga: avgFga,
    fg3m: avgFg3m,
    fg3a: avgFg3a,
    ftm: avgFtm,
    fta: avgFta,
    mpg,
    ts,
    fgPct,
    fg3Pct,
    ftPct,
    plusMinus,
    imageUrl: getPlayerImageUrl(basePlayer.id),
    profileUrl: getPlayerProfileUrl(basePlayer.id),
    gameResults,
  };
}
