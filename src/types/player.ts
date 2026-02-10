export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  position?: string;
  team?: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    nickname?: string;
  };
}

export interface Game {
  id: number;
  date: string;
  season: number;
  status: string;
  home_team: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    nickname?: string;
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    nickname?: string;
  };
  home_team_score: number;
  visitor_team_score: number;
  // Quarter scores (BDL provides for 2023+)
  home_q1?: number;
  home_q2?: number;
  home_q3?: number;
  home_q4?: number;
  visitor_q1?: number;
  visitor_q2?: number;
  visitor_q3?: number;
  visitor_q4?: number;
}

export interface GameStats {
  id: number;
  game: {
    id: number;
    date: string;
  };
  player: Player;
  team?: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    nickname?: string;
  };
  pts: number;
  reb: number;
  ast: number;
  fg: number; // field goals made
  fga: number; // field goals attempted
  fgm?: number;
  ft: number; // free throws made
  fta: number; // free throws attempted
  ftm?: number;
  min: string; // minutes played (format: "MM:SS")
  plus_minus?: number;
  stl?: number;
  blk?: number;
  tov?: number;
  turnover?: number;
  pf?: number;
  fg3?: number;
  fg3a?: number;
  fg3m?: number;
  oreb?: number;
  dreb?: number;
}

export interface GameResult {
  date: string;
  opponent: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    nickname?: string;
  };
  homeScore: number;
  awayScore: number;
  playerTeamScore: number;
  opponentScore: number;
  result: "W" | "L";
  isHome: boolean;
  /** Set when team won and overcame a qualifying deficit (e.g. down 22 after Q1) */
  comebackInfo?: { deficit: number; afterQuarters: number } | null;
}

export interface PlayerWeekStats {
  player: Player;
  games: number;
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
  per: number;
  perAdjusted?: number;
  pts: number;        // simple average
  reb: number;        // simple average
  ast: number;        // simple average
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
  mpg: number;
  ts: number;         // cumulative calculation
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  plusMinus: number;  // cumulative total
  imageUrl?: string;
  profileUrl: string;
  gameResults: GameResult[];
  teamSeason?: {
    wins: number;
    losses: number;
    seed: number;
    conference: string;
  };
  season?: {
    games: number;
    totals: {
      minutes: number;
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
      plusMinus: number;
    };
    perGame: {
      minutes: number;
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
    };
    percentages: {
      ts: number;
      fgPct: number;
      fg3Pct: number;
      ftPct: number;
    };
  };
  delta?: {
    totals: {
      minutes: number;
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
      plusMinus: number;
    };
    perGame: {
      minutes: number;
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
    };
    percentages: {
      ts: number;
      fgPct: number;
      fg3Pct: number;
      ftPct: number;
    };
  };
}

export interface DebugInfo {
  requests: number;
  errors: string[];
  gamesProcessed: number;
  statsProcessed: number;
  playersFound: number;
  cacheHit: boolean;
  dateRange: {
    start: string;
    end: string;
    usedFallback: boolean;
  };
  batchCount: number;
  processingTime: number; // milliseconds
  warnings: string[];
  rateLimitDelays: number; // total ms spent waiting
  apiCalls: Array<{
    endpoint: string;
    status: number;
    duration: number;
    timestamp: string;
  }>;
}
