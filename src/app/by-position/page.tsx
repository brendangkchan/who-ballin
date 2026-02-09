import { Suspense } from 'react';
import Link from 'next/link';
import PlayerCard from '@/components/PlayerCard';
import RefreshButtonWrapper from '@/components/RefreshButtonWrapper';
import FilterBar from '@/components/FilterBar';
import DebugPanel from '@/components/DebugPanel';
import { parseFilters, DEFAULT_MIN_GAMES, DEFAULT_MIN_PTS, DEFAULT_MIN_MINUTES } from '@/lib/filters';
import { pickBestByPosition, type PositionTsSummary } from '@/lib/position-utils';
import type { PlayerWeekStats, DebugInfo } from '@/types/player';
import type { PlayerFilters } from '@/lib/filters';

async function getTopPlayers(filters: PlayerFilters) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const params = new URLSearchParams();
  params.set('minGames', String(filters.minGames));
  params.set('minPts', String(filters.minPts));
  params.set('minMinutes', String(filters.minMinutes));
  const res = await fetch(`${baseUrl}/api/players/top-week?${params.toString()}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch players');
  }

  return res.json() as Promise<{
    players: PlayerWeekStats[];
    positionAverages?: PositionTsSummary;
    debug?: DebugInfo;
  }>;
}

function ByPositionContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-foreground-muted">Loading players...</p>
        </div>
      }
    >
      <ByPositionList searchParams={searchParams} />
    </Suspense>
  );
}

async function ByPositionList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolved = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const filters = parseFilters(resolved);
  const { players, debug, positionAverages } = await getTopPlayers(filters);
  const averages =
    positionAverages?.averages ??
    (positionAverages as unknown as { guard?: number; forward?: number; center?: number } | undefined);
  const counts = positionAverages?.counts ?? { guard: 0, forward: 0, center: 0 };
  const attemptCutoff = positionAverages?.attemptCutoff ?? 25;

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-foreground-muted">No games found in the last week.</p>
        <Link href="/" className="text-accent hover:underline">
          View all players
        </Link>
      </div>
    );
  }

  const best = pickBestByPosition(players);
  const hasAny = best.guard || best.forward || best.center;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-foreground-muted">
          No qualifying players with position data found this week.
        </p>
        <Link href="/" className="text-accent hover:underline">
          View all players
        </Link>
      </div>
    );
  }

  return (
    <>
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-6">
          <FilterBar />
          {positionAverages && (
            <div className="mt-6 rounded border border-foreground/10 bg-panel-tint/70 px-4 py-3 text-sm text-foreground-muted">
              Position TS averages (all players, FGA + FTA &gt; {attemptCutoff}): Guard {averages?.guard?.toFixed(1) ?? '—'}% ({counts.guard}), Forward {averages?.forward?.toFixed(1) ?? '—'}% ({counts.forward}), Center {averages?.center?.toFixed(1) ?? '—'}% ({counts.center})
            </div>
          )}
        </div>
      )}
      <div className="space-y-0">
        {best.guard && (
          <PlayerCard player={best.guard} label="Best Guard" positionAverages={positionAverages} />
        )}
        {best.forward && (
          <PlayerCard player={best.forward} label="Best Forward" positionAverages={positionAverages} />
        )}
        {best.center && (
          <PlayerCard player={best.center} label="Best Center" positionAverages={positionAverages} />
        )}
      </div>
      {debug && <DebugPanel debugInfo={debug} />}
    </>
  );
}

export default function ByPositionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  return (
    <div className="min-h-screen bg-background font-sans">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-10 flex items-center justify-between sm:mb-12">
          <div>
            <h1 className="font-serif font-extrabold text-foreground text-[clamp(1.5rem,8vw+1rem,4.5rem)] leading-[0.9]">
              <span className="highlight-title">By Position</span>
            </h1>
            <p className="mt-4 max-w-xl text-foreground-muted text-[clamp(0.875rem,0.5vw+0.8rem,1rem)]">
              Best guard, forward, and center this week (by PER). Same filters apply: at least {DEFAULT_MIN_GAMES} games, {DEFAULT_MIN_PTS} pts, {DEFAULT_MIN_MINUTES} minutes. Powered by{' '}
              <a href="https://www.balldontlie.io" target="_blank" rel="noopener noreferrer" className="text-accent-navy hover:underline">
                balldontlie.io
              </a>
              .
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-medium text-foreground-muted hover:text-foreground text-[clamp(0.8125rem,0.4vw+0.75rem,0.875rem)]"
            >
              All Players
            </Link>
            <RefreshButtonWrapper />
          </div>
        </div>
        <ByPositionContent searchParams={searchParams} />
      </main>
    </div>
  );
}
