export const DEFAULT_MIN_GAMES = 2;
export const DEFAULT_MIN_PTS = 20;
export const DEFAULT_MIN_MINUTES = 20;
export const MIN_MIN_GAMES = 1;
export const MIN_MIN_MINUTES = 5;

export interface PlayerFilters {
  minGames: number;
  minPts: number;
  minMinutes: number;
}

function parseNonNegativeInt(
  value: string | null | undefined,
  defaultVal: number
): number {
  if (value == null || value === '') return defaultVal;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return defaultVal;
  return n;
}

function parseMinInt(
  value: string | null | undefined,
  defaultVal: number,
  minVal: number
): number {
  if (value == null || value === '') return defaultVal;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return defaultVal;
  return n < minVal ? minVal : n;
}
function toString(val: string | string[] | null | undefined): string | null | undefined {
  if (val == null) return val;
  return Array.isArray(val) ? val[0] : val;
}

export function parseFilters(
  params:
    | { get?: (key: string) => string | null }
    | URLSearchParams
    | Record<string, string | string[] | undefined>
): PlayerFilters {
  const get = (key: string): string | null | undefined => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    if (typeof (params as Record<string, unknown>).get === 'function') {
      return (params as { get: (k: string) => string | null }).get(key);
    }
    return toString((params as Record<string, string | string[] | undefined>)[key]);
  };

  return {
    minGames: parseMinInt(get('minGames'), DEFAULT_MIN_GAMES, MIN_MIN_GAMES),
    minPts: parseNonNegativeInt(get('minPts'), DEFAULT_MIN_PTS),
    minMinutes: parseMinInt(get('minMinutes'), DEFAULT_MIN_MINUTES, MIN_MIN_MINUTES),
  };
}
