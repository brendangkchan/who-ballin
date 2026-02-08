export type SeasonTotalsRow = {
  playerId: number;
  season: number;
  games: number;
  minutes: number; // seconds
  pts: number;
  reb: number;
  ast: number;
  oreb: number;
  dreb: number;
  stl: number;
  blk: number;
  turnover: number;
  pf: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  plusMinus: number;
};

export function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export function buildSeasonStats(row: SeasonTotalsRow) {
  const games = row.games || 0;
  const minutes = row.minutes / 60;
  const perGameDivisor = games > 0 ? games : 1;
  const perGame = {
    minutes: minutes / perGameDivisor,
    pts: row.pts / perGameDivisor,
    reb: row.reb / perGameDivisor,
    ast: row.ast / perGameDivisor,
    oreb: row.oreb / perGameDivisor,
    dreb: row.dreb / perGameDivisor,
    stl: row.stl / perGameDivisor,
    blk: row.blk / perGameDivisor,
    tov: row.turnover / perGameDivisor,
    pf: row.pf / perGameDivisor,
    fgm: row.fgm / perGameDivisor,
    fga: row.fga / perGameDivisor,
    fg3m: row.fg3m / perGameDivisor,
    fg3a: row.fg3a / perGameDivisor,
    ftm: row.ftm / perGameDivisor,
    fta: row.fta / perGameDivisor,
  };

  const percentages = {
    ts: toPercent(row.pts, 2 * (row.fga + 0.44 * row.fta)),
    fgPct: toPercent(row.fgm, row.fga),
    fg3Pct: toPercent(row.fg3m, row.fg3a),
    ftPct: toPercent(row.ftm, row.fta),
  };

  return {
    games,
    totals: {
      minutes,
      pts: row.pts,
      reb: row.reb,
      ast: row.ast,
      oreb: row.oreb,
      dreb: row.dreb,
      stl: row.stl,
      blk: row.blk,
      tov: row.turnover,
      pf: row.pf,
      fgm: row.fgm,
      fga: row.fga,
      fg3m: row.fg3m,
      fg3a: row.fg3a,
      ftm: row.ftm,
      fta: row.fta,
      plusMinus: row.plusMinus,
    },
    perGame,
    percentages,
  };
}

export type SeasonStats = ReturnType<typeof buildSeasonStats>;

export type WeeklyStatsForDelta = {
  totalMinutes: number;
  totalPts: number;
  totalReb: number;
  totalAst: number;
  totalOreb: number;
  totalDreb: number;
  totalStl: number;
  totalBlk: number;
  totalTov: number;
  totalPf: number;
  totalFgm: number;
  totalFga: number;
  totalFg3m: number;
  totalFg3a: number;
  totalFtm: number;
  totalFta: number;
  plusMinus: number;
  mpg: number;
  pts: number;
  reb: number;
  ast: number;
  oreb: number;
  dreb: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  ts: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
};

export function buildDeltaStats(weekly: WeeklyStatsForDelta, season: SeasonStats) {
  return {
    totals: {
      minutes: weekly.totalMinutes - season.totals.minutes,
      pts: weekly.totalPts - season.totals.pts,
      reb: weekly.totalReb - season.totals.reb,
      ast: weekly.totalAst - season.totals.ast,
      oreb: weekly.totalOreb - season.totals.oreb,
      dreb: weekly.totalDreb - season.totals.dreb,
      stl: weekly.totalStl - season.totals.stl,
      blk: weekly.totalBlk - season.totals.blk,
      tov: weekly.totalTov - season.totals.tov,
      pf: weekly.totalPf - season.totals.pf,
      fgm: weekly.totalFgm - season.totals.fgm,
      fga: weekly.totalFga - season.totals.fga,
      fg3m: weekly.totalFg3m - season.totals.fg3m,
      fg3a: weekly.totalFg3a - season.totals.fg3a,
      ftm: weekly.totalFtm - season.totals.ftm,
      fta: weekly.totalFta - season.totals.fta,
      plusMinus: weekly.plusMinus - season.totals.plusMinus,
    },
    perGame: {
      minutes: weekly.mpg - season.perGame.minutes,
      pts: weekly.pts - season.perGame.pts,
      reb: weekly.reb - season.perGame.reb,
      ast: weekly.ast - season.perGame.ast,
      oreb: weekly.oreb - season.perGame.oreb,
      dreb: weekly.dreb - season.perGame.dreb,
      stl: weekly.stl - season.perGame.stl,
      blk: weekly.blk - season.perGame.blk,
      tov: weekly.tov - season.perGame.tov,
      pf: weekly.pf - season.perGame.pf,
      fgm: weekly.fgm - season.perGame.fgm,
      fga: weekly.fga - season.perGame.fga,
      fg3m: weekly.fg3m - season.perGame.fg3m,
      fg3a: weekly.fg3a - season.perGame.fg3a,
      ftm: weekly.ftm - season.perGame.ftm,
      fta: weekly.fta - season.perGame.fta,
    },
    percentages: {
      ts: weekly.ts - season.percentages.ts,
      fgPct: weekly.fgPct - season.percentages.fgPct,
      fg3Pct: weekly.fg3Pct - season.percentages.fg3Pct,
      ftPct: weekly.ftPct - season.percentages.ftPct,
    },
  };
}
