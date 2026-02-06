import { Suspense } from 'react';
import Link from 'next/link';
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
            <h1 className="font-serif text-[3.375rem] font-extrabold text-foreground sm:text-[4.5rem]">
              <span className="highlight-title">Who Been Ballin?</span>
            </h1>
            <p className="mt-4 max-w-md text-foreground-muted">
              These dudes been ballin' this <strong>past week</strong>. These are the top 10 guys ranked by offensive production using <a href="https://www.espn.com/nba/columns/story?columnist=hollinger_john&id=2850240" target="_blank" rel="noopener noreferrer" className="text-accent-navy font-bold hover:underline">PER</a> ("box score on steroids") filtering out the outliers.
            </p>
            <p className="max-w-md mt-4 text-xs text-foreground-muted">
              Minimum {DEFAULT_MIN_GAMES} games, {DEFAULT_MIN_PTS} pts, and {DEFAULT_MIN_MINUTES} min this week on teams that won more than lost. Powered by{' '}
              <a href="https://www.balldontlie.io" target="_blank" rel="noopener noreferrer" className="text-accent-navy hover:underline">
                balldontlie.io
              </a>
              .
            </p>
          </div>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <Suspense fallback={null}>
            <div className="mb-6">
              <FilterBar />
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/by-position"
                className="text-sm font-medium text-foreground-muted hover:text-foreground"
              >
                By Position
              </Link>
              <RefreshButtonWrapper />
            </div>
          </Suspense>
        )}
        <PlayersList searchParams={searchParams} />
      </main>
    </div>
  );
}

