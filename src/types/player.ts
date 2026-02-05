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
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
  };
  home_team_score: number;
  visitor_team_score: number;
}

export interface GameStats {
  id: number;
  game: {
    id: number;
    date: string;
  };
  player: Player;
  pts: number;
  reb: number;
  ast: number;
  fg: number; // field goals made
  fga: number; // field goals attempted
  ft: number; // free throws made
  fta: number; // free throws attempted
  min: string; // minutes played (format: "MM:SS")
  plus_minus?: number;
  stl?: number;
  blk?: number;
  tov?: number;
  pf?: number;
  fg3?: number;
  fg3a?: number;
}

export interface GameResult {
  date: string;
  opponent: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
  };
  homeScore: number;
  awayScore: number;
  playerTeamScore: number;
  opponentScore: number;
  result: "W" | "L";
  isHome: boolean;
}

export interface PlayerWeekStats {
  player: Player;
  games: number;
  per: number;
  pts: number;        // simple average
  reb: number;        // simple average
  ast: number;        // simple average
  ts: number;         // cumulative calculation
  plusMinus: number;  // cumulative total
  imageUrl?: string;
  gameResults: GameResult[];
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
