import Image from 'next/image';
import { format } from 'date-fns';
import type { PlayerWeekStats } from '@/types/player';
import { getTeamColors } from '@/lib/nba-team-colors';

interface PlayerCardProps {
  player: PlayerWeekStats;
  rank: number;
}

export default function PlayerCard({ player, rank }: PlayerCardProps) {
  const fullName = `${player.player.first_name} ${player.player.last_name}`;
  const teamName = player.player.team
    ? `${player.player.team.city} ${player.player.team.name}`
    : 'N/A';
  const teamColors = getTeamColors(player.player.team?.abbreviation);

  return (
    <div className="flex gap-5 py-6 sm:gap-6 sm:py-8">
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-foreground-muted/10">
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
          <span className="text-lg font-bold text-accent">#{rank}</span>
          <h3 className="text-xl font-semibold text-foreground">
            {fullName}
          </h3>
        </div>
        {teamColors && (
          <div
            className="mt-2 h-1 w-24 rounded-full"
            style={{
              background: teamColors.secondary
                ? `linear-gradient(90deg, ${teamColors.secondary}, transparent)`
                : `linear-gradient(90deg, ${teamColors.primary}, transparent)`,
            }}
            aria-hidden
          />
        )}
        <p className="mt-3 text-sm text-foreground-muted">{teamName}</p>
        <div
          className="mt-4 flex flex-wrap gap-x-6 gap-y-2 rounded-lg p-4 text-sm"
          style={
            teamColors
              ? {
                  background: `${teamColors.primary}15`,
                }
              : undefined
          }
        >
          <Stat label="pts" value={player.pts.toFixed(1)} />
          <Stat label="reb" value={player.reb.toFixed(1)} />
          <Stat label="ast" value={player.ast.toFixed(1)} />
          <Stat label="ts%" value={`${player.ts.toFixed(1)}%`} />
          <Stat
            label="+/-"
            value={
              player.plusMinus > 0
                ? `+${player.plusMinus.toFixed(1)}`
                : player.plusMinus.toFixed(1)
            }
          />
          <PerStat value={player.per.toFixed(1)} />
        </div>
        <div
          className="mt-4 rounded-lg p-4"
          style={
            teamColors
              ? {
                  background: `${teamColors.primary}15`,
                }
              : undefined
          }
        >
          <p className="mb-2 text-xs font-semibold text-foreground">
            Games This Week
          </p>
          <div className="space-y-1">
            {player.gameResults.map((game, index) => (
              <GameResultRow key={index} game={game} />
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-foreground-muted">
          {player.games} game{player.games !== 1 ? 's' : ''} this week
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="ml-1 text-sm font-normal text-foreground-muted">{label}</span>
    </div>
  );
}

function PerStat({ value }: { value: string }) {
  return (
    <div>
      <span className="text-2xl font-bold text-accent">{value}</span>
      <span className="ml-1 text-sm font-normal text-foreground-muted">PER</span>
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
          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
          : 'bg-red-500/10 text-red-700 dark:text-red-400'
      }`}
    >
      <span className="text-foreground-muted" aria-hidden>↳</span>
      <span className="font-medium">
        {gameDate} {vsText} {opponentName}: {scoreText} ({game.result})
      </span>
    </div>
  );
}
