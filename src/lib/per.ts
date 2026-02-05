import type { GameStats } from '@/types/player';

// Simplified PER calculation
// Full PER requires league averages, but we'll use a simplified version
// that's still effective for ranking
export function calculatePER(stats: GameStats[]): number {
  if (stats.length === 0) return 0;

  const totals = stats.reduce(
    (acc, stat) => {
      const minutes = parseMinutes((stat as any).min ?? (stat as any).minutes);
      const fg = (stat as any).fgm ?? (stat as any).fg ?? 0;
      const ft = (stat as any).ftm ?? (stat as any).ft ?? 0;
      const tov = (stat as any).turnover ?? (stat as any).tov ?? 0;
      return {
        pts: acc.pts + stat.pts,
        reb: acc.reb + stat.reb,
        ast: acc.ast + stat.ast,
        stl: acc.stl + (stat.stl || 0),
        blk: acc.blk + (stat.blk || 0),
        tov: acc.tov + tov,
        fg: acc.fg + fg,
        fga: acc.fga + stat.fga,
        ft: acc.ft + ft,
        fta: acc.fta + stat.fta,
        pf: acc.pf + (stat.pf || 0),
        minutes: acc.minutes + minutes,
      };
    },
    {
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fg: 0,
      fga: 0,
      ft: 0,
      fta: 0,
      pf: 0,
      minutes: 0,
    }
  );

  if (!Number.isFinite(totals.minutes) || totals.minutes <= 0) return 0;

  // Simplified PER formula (without league averages)
  // This is a weighted combination that approximates PER
  const per =
    (totals.pts * 1.0 +
      totals.reb * 0.7 +
      totals.ast * 0.9 +
      totals.stl * 1.5 +
      totals.blk * 1.2 -
      totals.tov * 1.0 -
      totals.pf * 0.3 +
      (totals.fg - totals.fga) * 0.5 +
      (totals.ft - totals.fta) * 0.3) /
    (totals.minutes / 36); // normalize to per 36 minutes

  return Number.isFinite(per) ? per : 0;
}

export function parseMinutes(minString: string | null | undefined): number {
  if (minString == null || typeof minString !== 'string') return 0;
  const trimmed = minString.trim();
  if (trimmed === '') return 0;
  // Handle decimal format (e.g. "32.5")
  if (!trimmed.includes(':')) {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  // Handle "MM:SS" format
  const parts = trimmed.split(':');
  const mins = Number(parts[0]) || 0;
  const secs = Number(parts[1]) || 0;
  const result = mins + secs / 60;
  return Number.isFinite(result) ? result : 0;
}
