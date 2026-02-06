import Image from 'next/image';
import type { PlayerWeekStats } from '@/types/player';
import { getTeamColors } from '@/lib/nba-team-colors';

interface PlayerCardProps {
  player: PlayerWeekStats;
  rank?: number;
  label?: string;
}

export default function PlayerCard({ player, rank, label }: PlayerCardProps) {
  const fullName = `${player.player.first_name} ${player.player.last_name}`;
  const teamName = player.player.team
    ? `${player.player.team.city} ${player.player.team.name}`
    : 'N/A';
  const teamColors = getTeamColors(player.player.team?.abbreviation);
  const wins = player.gameResults.filter((g) => g.result === 'W');
  const losses = player.gameResults.filter((g) => g.result === 'L');

  const isRankingMode = rank != null && label == null;

  return (
    <div className="rounded-lg bg-neutral-100 py-6 sm:py-8">
      {isRankingMode ? (
        <>
          <div className="relative h-[300px] min-w-[300px] w-full">
            <a
              href={player.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute left-0 top-0 h-[300px] w-[300px] overflow-hidden rounded-full"
              aria-label={`View ${fullName} on NBA.com`}
            >
              <Image
                src={player.imageUrl || '/placeholder-player.svg'}
                alt={fullName}
                fill
                className="object-cover grayscale"
              />
            </a>
            <div
              className="absolute bottom-2 left-2 flex aspect-square min-w-[4.5rem] min-h-[4.5rem] items-center justify-center rounded-full p-2 sm:min-w-[5rem] sm:min-h-[5rem] sm:p-2.5"
              style={teamColors ? { backgroundColor: teamColors.primary } : { backgroundColor: '#666' }}
            >
              <span
                className="font-serif text-[2.24rem] font-extrabold leading-none text-white sm:text-[2.72rem]"
                style={{ transform: 'translateY(0.06em)' }}
              >
                #{rank}
              </span>
            </div>
            <div className="absolute bottom-4 left-[240px] right-4 top-12 flex flex-col justify-end gap-1 text-left">
              <div>
                <div
                  className="font-serif text-[3.375rem] font-extrabold leading-[0.80] sm:text-[4.5rem]"
                  style={teamColors ? { color: teamColors.primary } : undefined}
                >
                  {fullName}
                </div>
                <div
                  className="mt-1 pl-8 font-sans text-sm font-normal sm:text-base italic"
                  style={teamColors ? { color: teamColors.primary } : { color: 'var(--foreground-muted)' }}
                >
                  {teamName}
                </div>
              </div>
              <div className="flex flex-col items-end gap-y-0.1 pr-4 text-right">
                <Stat label="pts" value={player.pts.toFixed(1)} size="lg" />
                <Stat label="reb" value={player.reb.toFixed(1)} size="lg" />
                <Stat label="ast" value={player.ast.toFixed(1)} size="lg" />
                <span className="text-xs italic text-foreground-muted">
                  in {Math.round(player.totalMinutes)} min
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 rounded-lg bg-neutral-200/60 p-4 text-sm">
            <div className="flex gap-x-6 gap-y-2">
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
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-neutral-200/60 p-4">
            <div>
              <p className="mb-2 font-bold text-emerald-700 dark:text-emerald-600">
                {wins.length === 1 ? '1 Win' : `${wins.length} Wins`}
              </p>
              <div className="space-y-1">
                {wins.map((game, index) => (
                  <GameResultRow key={index} game={game} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-bold text-rose-700 dark:text-rose-600">
                {losses.length === 1 ? '1 Loss' : `${losses.length} Losses`}
              </p>
              <div className="space-y-1">
                {losses.map((game, index) => (
                  <GameResultRow key={index} game={game} />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex gap-5 sm:gap-6">
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
            <div className="block">
              {(label != null || rank != null) && (
                <div
                  className="block w-full rounded py-1 pl-2 pr-4"
                  style={
                    teamColors
                      ? {
                        background: `linear-gradient(90deg, ${teamColors.labelGradientStart}, transparent)`,
                      }
                      : undefined
                  }
                >
                  <span className="block text-lg font-bold text-foreground">
                    {label ?? (rank != null ? `#${rank}` : null)}
                  </span>
                </div>
              )}
              <div
                className={`flex items-baseline justify-between gap-4 ${label != null || rank != null ? 'mt-2' : ''}`}
              >
                <h3
                  className="font-serif text-2xl font-extrabold sm:text-3xl"
                  style={teamColors ? { color: teamColors.primary } : undefined}
                >
                  {fullName}
                </h3>
                <p
                  className="text-xl"
                  style={
                    teamColors
                      ? { color: teamColors.primary, opacity: 0.9 }
                      : { color: 'var(--foreground-muted)' }
                  }
                >
                  {teamName}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-lg bg-neutral-200/60 p-4 text-sm">
              <div className="flex items-baseline gap-x-6 gap-y-2">
                <Stat label="pts" value={player.pts.toFixed(1)} />
                <Stat label="reb" value={player.reb.toFixed(1)} />
                <Stat label="ast" value={player.ast.toFixed(1)} />
                <span className="text-sm font-normal italic text-foreground-muted">
                  in {Math.round(player.totalMinutes)} min
                </span>
              </div>
              <div className="flex gap-x-6 gap-y-2">
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
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-neutral-200/60 p-4">
              <div>
                <p className="mb-2 font-bold text-emerald-700 dark:text-emerald-600">
                  {wins.length === 1 ? '1 Win' : `${wins.length} Wins`}
                </p>
                <div className="space-y-1">
                  {wins.map((game, index) => (
                    <GameResultRow key={index} game={game} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-bold text-rose-700 dark:text-rose-600">
                  {losses.length === 1 ? '1 Loss' : `${losses.length} Losses`}
                </p>
                <div className="space-y-1">
                  {losses.map((game, index) => (
                    <GameResultRow key={index} game={game} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, size = 'default' }: { label: string; value: string; size?: 'default' | 'lg' }) {
  const valueClass = size === 'lg' ? 'text-3xl' : 'text-2xl';
  const labelClass = size === 'lg' ? 'text-base' : 'text-sm';
  return (
    <div>
      <span className={`${valueClass} font-bold text-foreground`}>{value}</span>
      <span className={`ml-1 ${labelClass} font-normal text-foreground-muted`}>{label}</span>
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
  const opponentName = game.opponent.name ?? game.opponent.abbreviation;
  const scoreText = `${game.playerTeamScore}-${game.opponentScore}`;

  return (
    <div className="text-base font-normal text-foreground">
      {opponentName}: {scoreText}
    </div>
  );
}
