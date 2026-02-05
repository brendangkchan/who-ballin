import { Suspense } from 'react';
import PlayerCard from '@/components/PlayerCard';
import RefreshButtonWrapper from '@/components/RefreshButtonWrapper';
import FilterBar from '@/components/FilterBar';
import DebugPanel from '@/components/DebugPanel';
import { parseFilters, DEFAULT_MIN_GAMES, DEFAULT_MIN_PTS, DEFAULT_MIN_MINUTES } from '@/lib/filters';
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
    debug?: DebugInfo;
  }>;
}

function PlayersList({
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
      <PlayersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PlayersContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolved = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const filters = parseFilters(resolved);
  const { players, debug } = await getTopPlayers(filters);

  if (players.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-foreground-muted">
          No games found in the last week.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-0">
        {players.map((player, index) => (
          <PlayerCard key={player.player.id} player={player} rank={index + 1} />
        ))}
      </div>
      {debug && <DebugPanel debugInfo={debug} />}
    </>
  );
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  return (
    <div className="min-h-screen bg-background font-sans">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-10 flex items-center justify-between sm:mb-12">
          <div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Who Ballin
            </h1>
            <div className="mt-2 h-1 w-16 bg-accent" aria-hidden />
            <p className="mt-4 max-w-xl text-foreground-muted">
              Players with at least {DEFAULT_MIN_GAMES} games, {DEFAULT_MIN_PTS} pts, and {DEFAULT_MIN_MINUTES} minutes this week, ranked by Player Efficiency Rating (PER).
            </p>
          </div>
          <RefreshButtonWrapper />
        </div>
        {process.env.NODE_ENV === 'development' && (
          <Suspense fallback={null}>
            <div className="mb-6">
              <FilterBar />
            </div>
          </Suspense>
        )}
        <PlayersList searchParams={searchParams} />
      </main>
    </div>
  );
}

