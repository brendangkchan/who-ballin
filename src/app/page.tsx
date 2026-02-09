import { Suspense } from 'react';
import Link from 'next/link';
import PlayerCard from '@/components/PlayerCard';
import RefreshButtonWrapper from '@/components/RefreshButtonWrapper';
import FilterBar from '@/components/FilterBar';
import DebugPanel from '@/components/DebugPanel';
import { parseFilters, DEFAULT_MIN_GAMES, DEFAULT_MIN_PTS, DEFAULT_MIN_MINUTES } from '@/lib/filters';
import { formatLastUpdated } from '@/lib/utils';
import type { PlayerWeekStats, DebugInfo } from '@/types/player';
import type { PositionTsSummary } from '@/lib/position-utils';
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
    generatedAt?: string;
  }>;
}

function PlayersList({
  players,
  debug,
  positionAverages,
}: {
  players: PlayerWeekStats[];
  debug: DebugInfo | undefined;
  positionAverages: PositionTsSummary | undefined;
}) {
  const averages =
    positionAverages?.averages ??
    (positionAverages as unknown as { guard?: number; forward?: number; center?: number } | undefined);
  const counts = positionAverages?.counts ?? { guard: 0, forward: 0, center: 0 };
  const attemptCutoff = positionAverages?.attemptCutoff ?? 25;

  return (
    <>
      {players.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-foreground-muted">No games found in the last week.</p>
        </div>
      ) : (
        <>
          <div className="space-y-0">
            {players.map((player, index) => (
              <PlayerCard
                key={player.player.id}
                player={player}
                rank={index + 1}
                positionAverages={positionAverages}
              />
            ))}
          </div>
          {debug && <DebugPanel debugInfo={debug} />}
        </>
      )}
    </>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolved = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const filters = parseFilters(resolved);
  const { players, debug, generatedAt, positionAverages } = await getTopPlayers(filters);
  const averages =
    positionAverages?.averages ??
    (positionAverages as unknown as { guard?: number; forward?: number; center?: number } | undefined);
  const counts = positionAverages?.counts ?? { guard: 0, forward: 0, center: 0 };
  const attemptCutoff = positionAverages?.attemptCutoff ?? 25;

  return (
    <div className="min-h-screen bg-background font-sans">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-10 flex items-center justify-between sm:mb-12">
          <div>
            <h1 className="font-serif font-extrabold text-foreground text-[clamp(1.5rem,8vw+1rem,4.5rem)] leading-[0.9]">
              <span className="highlight-title">Who Been Ballin?</span>
            </h1>
            <p className="mt-4 max-w-md text-foreground-muted text-[clamp(0.875rem,0.5vw+0.8rem,1rem)]">
              These dudes been ballin' this <strong>past week</strong>. These are the top 10 guys ranked by offensive production using <a href="https://www.espn.com/nba/columns/story?columnist=hollinger_john&id=2850240" target="_blank" rel="noopener noreferrer" className="text-accent-navy font-bold hover:underline">PER</a> ("box score on steroids") filtering out the outliers.
            </p>
            {generatedAt && (
              <p className="max-w-md mt-4 text-foreground-muted text-[clamp(0.6875rem,0.3vw+0.65rem,0.75rem)]">
                Updated daily. Last updated{' '}
                <span className="font-serif font-bold text-[clamp(0.75rem,0.4vw+0.7rem,0.9rem)]">
                  {formatLastUpdated(generatedAt)}.
                </span>
              </p>
            )}
            <p className="max-w-md mt-2 text-foreground-muted text-[clamp(0.6875rem,0.3vw+0.65rem,0.75rem)]">
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
            {positionAverages && (
              <div className="mb-6 rounded border border-foreground/10 bg-panel-tint/70 px-4 py-3 text-sm text-foreground-muted">
                Position TS averages (all players, FGA + FTA &gt; {attemptCutoff}): Guard {averages?.guard?.toFixed(1) ?? '—'}% ({counts.guard}), Wing {averages?.forward?.toFixed(1) ?? '—'}% ({counts.forward}), Big {averages?.center?.toFixed(1) ?? '—'}% ({counts.center})
              </div>
            )}
            <div className="flex items-center gap-3">
              <Link
                href="/by-position"
                className="font-medium text-foreground-muted hover:text-foreground text-[clamp(0.8125rem,0.4vw+0.75rem,0.875rem)]"
              >
                By Position
              </Link>
              <RefreshButtonWrapper />
            </div>
          </Suspense>
        )}
        <PlayersList players={players} debug={debug} positionAverages={positionAverages} />
      </main>
    </div>
  );
}
