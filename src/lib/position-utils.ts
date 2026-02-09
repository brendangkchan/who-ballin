import type { PlayerWeekStats } from '@/types/player';

export type PositionCategory = 'guard' | 'forward' | 'center';

const GUARD_POSITIONS = new Set(['G']);
const FORWARD_POSITIONS = new Set(['F', 'G-F', 'F-G']);
const CENTER_POSITIONS = new Set(['C', 'F-C', 'C-F']);
const HYBRID_GUARD_FORWARD = new Set(['G-F', 'F-G']);
const HYBRID_FORWARD_CENTER = new Set(['F-C', 'C-F']);

/**
 * Returns the position category for a player.
 * Hybrids slot into the category that opens the other: G-F/F-G → Forward (opens Guard),
 * F-C/C-F → Center (opens Forward). Returns null if position is missing or unknown.
 */
export function getPositionCategory(position: string | undefined): PositionCategory | null {
  if (!position || typeof position !== 'string') return null;
  const pos = position.trim().toUpperCase();
  if (GUARD_POSITIONS.has(pos)) return 'guard';
  if (FORWARD_POSITIONS.has(pos)) return 'forward';
  if (CENTER_POSITIONS.has(pos)) return 'center';
  return null;
}

export function getPositionCategories(position: string | undefined): PositionCategory[] {
  if (!position || typeof position !== 'string') return [];
  const pos = position.trim().toUpperCase();
  if (HYBRID_GUARD_FORWARD.has(pos)) return ['guard', 'forward'];
  if (HYBRID_FORWARD_CENTER.has(pos)) return ['forward', 'center'];
  if (GUARD_POSITIONS.has(pos)) return ['guard'];
  if (FORWARD_POSITIONS.has(pos)) return ['forward'];
  if (CENTER_POSITIONS.has(pos)) return ['center'];
  return [];
}

export interface BestByPosition {
  guard?: PlayerWeekStats;
  forward?: PlayerWeekStats;
  center?: PlayerWeekStats;
}

export interface PositionTsAverages {
  guard?: number;
  forward?: number;
  center?: number;
}

export interface PositionTsSummary {
  averages: PositionTsAverages;
  counts: {
    guard: number;
    forward: number;
    center: number;
  };
  attemptCutoff: number;
}

export function calculatePositionTsAverages(players: PlayerWeekStats[]): PositionTsSummary {
  const attemptCutoff = 15;
  const totals: Record<PositionCategory, { sum: number; count: number }> = {
    guard: { sum: 0, count: 0 },
    forward: { sum: 0, count: 0 },
    center: { sum: 0, count: 0 },
  };

  for (const p of players) {
    if (!Number.isFinite(p.ts)) continue;
    if (p.totalFga + p.totalFta <= attemptCutoff) continue;
    const cats = getPositionCategories(p.player.position);
    if (cats.length === 0) continue;
    for (const cat of cats) {
      totals[cat].sum += p.ts;
      totals[cat].count += 1;
    }
  }

  return {
    attemptCutoff,
    counts: {
      guard: totals.guard.count,
      forward: totals.forward.count,
      center: totals.center.count,
    },
    averages: {
      guard: totals.guard.count > 0 ? totals.guard.sum / totals.guard.count : undefined,
      forward: totals.forward.count > 0 ? totals.forward.sum / totals.forward.count : undefined,
      center: totals.center.count > 0 ? totals.center.sum / totals.center.count : undefined,
    },
  };
}

/**
 * Picks the best player (by PER) in each position category.
 * Hybrids slot into the category that opens the other (G-F/F-G → Forward, F-C/C-F → Center).
 * Skips players with no position.
 */
export function pickBestByPosition(players: PlayerWeekStats[]): BestByPosition {
  const result: BestByPosition = {};
  const byCategory: Record<PositionCategory, PlayerWeekStats[]> = {
    guard: [],
    forward: [],
    center: [],
  };

  for (const p of players) {
    const cat = getPositionCategory(p.player.position);
    if (cat) byCategory[cat].push(p);
  }

  for (const cat of ['guard', 'forward', 'center'] as const) {
    const list = byCategory[cat];
    if (list.length === 0) continue;
    const best = list.reduce((a, b) => (a.per >= b.per ? a : b));
    result[cat] = best;
  }

  return result;
}
