import Image from 'next/image';
import { format } from 'date-fns';
import type { PlayerWeekStats } from '@/types/player';

interface PlayerCardProps {
  player: PlayerWeekStats;
  rank: number;
}

export default function PlayerCard({ player, rank }: PlayerCardProps) {
  const fullName = `${player.player.first_name} ${player.player.last_name}`;
  const teamName = player.player.team
    ? `${player.player.team.city} ${player.player.team.name}`
    : 'N/A';

  return (
    <div className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <a
          href={player.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-full w-full"
          aria-label={`View ${fullName} on NBA.com`}
        >
          <Image
            src={player.imageUrl || '/placeholder-player.svg'}
            alt={fullName}
            fill
            className="object-cover"
          />
        </a>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-zinc-400">#{rank}</span>
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {fullName}
          </h3>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{teamName}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <Stat label="PTS" value={player.pts.toFixed(1)} />
          <Stat label="REB" value={player.reb.toFixed(1)} />
          <Stat label="AST" value={player.ast.toFixed(1)} />
          <Stat label="TS%" value={`${player.ts.toFixed(1)}%`} />
          <Stat
            label="+/-"
            value={
              player.plusMinus > 0
                ? `+${player.plusMinus.toFixed(1)}`
                : player.plusMinus.toFixed(1)
            }
          />
          <Stat label="PER" value={player.per.toFixed(1)} />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Games This Week:
          </p>
          <div className="space-y-1">
            {player.gameResults.map((game, index) => (
              <GameResultRow key={index} game={game} />
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          {player.games} game{player.games !== 1 ? 's' : ''} this week
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-zinc-500 dark:text-zinc-400">{label}:</span>{' '}
      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </span>
    </div>
  );
}

function GameResultRow({ game }: { game: any }) {
  const gameDate = format(new Date(game.date), 'MMM d');
  const opponentName = game.opponent.abbreviation;
  const vsText = game.isHome ? 'vs' : '@';
  const scoreText = `${game.playerTeamScore}-${game.opponentScore}`;
  const isWin = game.result === 'W';

  return (
    <div
      className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
        isWin
          ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
          : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      }`}
    >
      <span>{isWin ? '✅' : '❌'}</span>
      <span className="font-medium">
        {gameDate} {vsText} {opponentName}: {scoreText} ({game.result})
      </span>
    </div>
  );
}
