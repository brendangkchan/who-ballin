import { Suspense } from 'react';
import PlayerCard from '@/components/PlayerCard';
import RefreshButtonWrapper from '@/components/RefreshButtonWrapper';
import DebugPanel from '@/components/DebugPanel';
import type { PlayerWeekStats, DebugInfo } from '@/types/player';

async function getTopPlayers() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/players/top-week`, {
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

function PlayersList() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-zinc-600 dark:text-zinc-400">Loading players...</p>
        </div>
      }
    >
      <PlayersContent />
    </Suspense>
  );
}

async function PlayersContent() {
  const { players, debug } = await getTopPlayers();

  if (players.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-zinc-600 dark:text-zinc-400">
          No games found in the last week.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {players.map((player, index) => (
          <PlayerCard key={player.player.id} player={player} rank={index + 1} />
        ))}
      </div>
      {debug && <DebugPanel debugInfo={debug} />}
    </>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              All Players This Week
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Ranked by Player Efficiency Rating (PER)
            </p>
          </div>
          <RefreshButtonWrapper />
        </div>
        <PlayersList />
      </main>
    </div>
  );
}

