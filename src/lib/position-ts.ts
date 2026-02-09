import type { PositionTsSummary } from '@/lib/position-utils';

export const POSITION_TS_ATTEMPT_CUTOFF = 15;

type PositionGroup = 'guard' | 'wing' | 'big';

const GUARD_POSITIONS = new Set(['G']);
const WING_POSITIONS = new Set(['F', 'G-F', 'F-G']);
const BIG_POSITIONS = new Set(['C', 'F-C', 'C-F']);

function getPositionGroups(position: string | null | undefined): PositionGroup[] {
  if (!position || typeof position !== 'string') return [];
  const pos = position.trim().toUpperCase();
  const groups: PositionGroup[] = [];
  if (GUARD_POSITIONS.has(pos)) groups.push('guard');
  if (WING_POSITIONS.has(pos)) groups.push('wing');
  if (BIG_POSITIONS.has(pos)) groups.push('big');
  return groups;
}

export function computePositionTsSummary(
  rows: { pts: number; fga: number; fta: number; position: string | null }[],
  attemptCutoff = POSITION_TS_ATTEMPT_CUTOFF
): PositionTsSummary {
  const totals: Record<PositionGroup, { pts: number; fga: number; fta: number; count: number }> = {
    guard: { pts: 0, fga: 0, fta: 0, count: 0 },
    wing: { pts: 0, fga: 0, fta: 0, count: 0 },
    big: { pts: 0, fga: 0, fta: 0, count: 0 },
  };

  for (const row of rows) {
    const attempts = row.fga + row.fta;
    if (!Number.isFinite(attempts) || attempts <= attemptCutoff) continue;
    const groups = getPositionGroups(row.position);
    if (groups.length === 0) continue;
    for (const group of groups) {
      totals[group].pts += row.pts;
      totals[group].fga += row.fga;
      totals[group].fta += row.fta;
      totals[group].count += 1;
    }
  }

  function weightedTs(group: PositionGroup): number | undefined {
    const denom = 2 * (totals[group].fga + 0.44 * totals[group].fta);
    if (denom <= 0) return undefined;
    return (totals[group].pts / denom) * 100;
  }

  return {
    attemptCutoff,
    counts: {
      guard: totals.guard.count,
      forward: totals.wing.count,
      center: totals.big.count,
    },
    averages: {
      guard: weightedTs('guard'),
      forward: weightedTs('wing'),
      center: weightedTs('big'),
    },
  };
}
