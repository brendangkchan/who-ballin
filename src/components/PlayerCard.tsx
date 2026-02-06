import Image from 'next/image';
import type { PlayerWeekStats } from '@/types/player';
import { getTeamColors } from '@/lib/nba-team-colors';
import NoteCardBorder from '@/components/NoteCardBorder';

interface PlayerCardProps {
  player: PlayerWeekStats;
  rank?: number;
  label?: string;
}

function getTeamGrade(
  winsCount: number,
  lossesCount: number
): { letter: string; colorClass: string } {
  const total = winsCount + lossesCount;
  if (total === 0) {
    return { letter: '—', colorClass: 'text-foreground-muted' };
  }
  const pct = (winsCount / total) * 100;
  if (pct >= 100) return { letter: 'A+', colorClass: 'text-emerald-700 dark:text-emerald-600' };
  if (pct >= 70) return { letter: 'A', colorClass: 'text-emerald-700 dark:text-emerald-600' };
  if (pct >= 60) return { letter: 'B', colorClass: 'text-amber-600 dark:text-amber-500' };
  if (pct >= 50) return { letter: 'C', colorClass: 'text-amber-600 dark:text-amber-500' };
  if (pct >= 40) return { letter: 'D', colorClass: 'text-rose-700 dark:text-rose-600' };
  return { letter: 'F', colorClass: 'text-rose-700 dark:text-rose-600' };
}

export default function PlayerCard({ player, rank, label }: PlayerCardProps) {
  const fullName = `${player.player.first_name} ${player.player.last_name}`;
  const teamName = player.player.team
    ? `${player.player.team.city} ${player.player.team.name}`
    : 'N/A';
  const teamColors = getTeamColors(player.player.team?.abbreviation);
  const wins = player.gameResults.filter((g) => g.result === 'W');
  const losses = player.gameResults.filter((g) => g.result === 'L');
  const { letter: gradeLetter, colorClass: gradeColorClass } = getTeamGrade(wins.length, losses.length);

  const isRankingMode = rank != null && label == null;

  const rankingStatsContent = (
    <>
      <div className="text-foreground-muted text-[clamp(0.6875rem,0.3vw+0.65rem,0.75rem)]">averaged</div>
      <div className="flex gap-x-6 gap-y-2">
        <Stat label="pts" value={player.pts.toFixed(1)} size="lg" />
        <Stat label="reb" value={player.reb.toFixed(1)} size="lg" />
        <Stat label="ast" value={player.ast.toFixed(1)} size="lg" />
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1 gap-y-1">
        <span>
          <span className="ml-4 text-foreground-muted text-[clamp(0.8125rem,0.4vw+0.75rem,0.875rem)]">on </span>
          <span className="font-bold text-accent text-[clamp(1rem,2vw+0.75rem,1.25rem)]">{player.ts.toFixed(1)}%</span>
          <span className="ml-1 text-foreground-muted text-[clamp(0.8125rem,0.4vw+0.75rem,0.875rem)]">TS</span>
        </span>
        <span className="text-foreground-muted text-[clamp(0.8125rem,0.4vw+0.75rem,0.875rem)]">
          and was
          <span
            className={
              "ml-1 " +
              (player.plusMinus > 0
                ? "font-bold text-emerald-700 dark:text-emerald-500"
                : "font-bold")
            }
          >
            {player.plusMinus > 0 ? `+${player.plusMinus.toFixed(0)}` : player.plusMinus.toFixed(0)}
          </span>
          {" "}in {Math.round(player.totalMinutes)} minutes
        </span>
      </div>
    </>
  );

  const rankingNameBlock = (
    <div
      className="font-serif text-[3.375rem] font-extrabold leading-[0.80] sm:text-[4.5rem]"
      style={teamColors ? { color: teamColors.primary } : undefined}
    >
      {fullName}
    </div>
  );

  const rankingTeamBlock = (teamPlClass: string) => (
    <div
      className={`font-sans text-sm font-normal sm:text-base italic ${teamPlClass}`.trim()}
      style={teamColors ? { color: teamColors.primary } : { color: 'var(--foreground-muted)' }}
    >
      {teamName}
    </div>
  );

  return (
    <div className="relative rounded-lg bg-background py-6 sm:py-8 noise-overlay">
      {isRankingMode ? (
        <>
          <div className="relative mx-auto h-[300px] w-full min-w-[300px] max-w-[300px] sm:mx-0 sm:max-w-none">
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
            <div className="absolute left-[240px] right-4 top-4 hidden flex-col gap-1 text-left sm:flex">
              {rankingNameBlock}
              {rankingTeamBlock('pl-8')}
              <div className="mt-8 pl-24">
                {rankingStatsContent}
              </div>
            </div>
          </div>
          <div className="block pl-2 text-left sm:hidden">
            <div className="mt-3 flex flex-col gap-1">
              {rankingNameBlock}
              {rankingTeamBlock('')}
            </div>
          </div>
          <div className="block sm:hidden mt-6 pl-2 text-left">
            {rankingStatsContent}
          </div>
          <div className="note-card mt-8 sm:mt-12">
            <NoteCardBorder borderColor={teamColors?.primary ?? '#1a1a1a'}>
              <div className="col-span-2 mb-2 flex items-baseline">
                <span className="mr-2 font-serif text-lg font-bold text-foreground">Team Grade: </span>
                <span className={`font-sans text-xl font-bold ${gradeColorClass}`}>{gradeLetter}</span>
              </div>
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
            </NoteCardBorder>
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
            <div className="mt-4 flex flex-col gap-2 rounded-lg bg-panel-tint/80 p-4 text-sm">
              <div className="flex items-baseline gap-x-6 gap-y-2">
                <Stat label="pts" value={`averaging ${player.pts.toFixed(1)}`} />
                <Stat label="reb" value={player.reb.toFixed(1)} />
                <Stat label="ast" value={player.ast.toFixed(1)} />
                <div className="flex items-baseline">
                  <span className="text-xs font-normal text-foreground-muted">and was </span>
                  <Stat
                    label={`in ${Math.round(player.totalMinutes)} min`}
                    value={player.plusMinus > 0 ? `+${player.plusMinus.toFixed(0)}` : player.plusMinus.toFixed(0)}
                  />
                </div>
              </div>
              <div className="flex gap-x-6 gap-y-2">
                <div className="flex items-baseline">
                  <span className="text-sm text-foreground-muted">on </span>
                  <span className="ml-1 text-xl font-bold text-accent">{player.ts.toFixed(1)}%</span>
                  <span className="ml-1 text-sm text-foreground-muted">TS</span>
                </div>
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
            <div className="note-card mt-4">
              <NoteCardBorder borderColor={teamColors?.primary ?? '#1a1a1a'}>
                <div className="col-span-2 mb-2 flex items-baseline">
                  <span className="mr-2 font-serif text-lg font-bold text-foreground">Weekly Grade: </span>
                  <span className={`font-sans text-lg font-bold ${gradeColorClass}`}>{gradeLetter}</span>
                </div>
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
              </NoteCardBorder>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, size = 'default' }: { label: string; value: string; size?: 'default' | 'lg' }) {
  const valueClass = size === 'lg' ? 'text-[clamp(1.25rem,4vw+1rem,1.875rem)]' : 'text-[clamp(1.125rem,2vw+0.875rem,1.5rem)]';
  const labelClass = size === 'lg' ? 'text-[clamp(0.875rem,0.5vw+0.75rem,1rem)]' : 'text-[clamp(0.8125rem,0.4vw+0.75rem,0.875rem)]';
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
      <span className="font-bold text-accent text-[clamp(1.125rem,2vw+0.875rem,1.5rem)]">{value}</span>
      <span className="ml-1 font-normal text-foreground-muted text-[clamp(0.8125rem,0.4vw+0.75rem,0.875rem)]">PER</span>
    </div>
  );
}

function GameResultRow({ game }: { game: any }) {
  const opponentName = game.opponent.name ?? game.opponent.abbreviation;
  const scoreText = `${game.playerTeamScore}-${game.opponentScore}`;

  return (
    <div className="font-normal text-foreground text-[clamp(0.875rem,0.5vw+0.8rem,1rem)]">
      {opponentName}: {scoreText}
    </div>
  );
}
