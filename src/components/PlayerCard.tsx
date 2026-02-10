import Image from 'next/image';
import type { PlayerWeekStats } from '@/types/player';
import { getTeamColors } from '@/lib/nba-team-colors';
import { getPositionCategory, type PositionTsSummary } from '@/lib/position-utils';
import { getNbaPlayerId } from '@/lib/utils';
import NoteCardBorder from '@/components/NoteCardBorder';

interface PlayerCardProps {
  player: PlayerWeekStats;
  rank?: number;
  label?: string;
  positionAverages?: PositionTsSummary;
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
  if (pct >= 100) return { letter: 'A+', colorClass: 'text-positive' };
  if (pct >= 70) return { letter: 'A', colorClass: 'text-positive' };
  if (pct >= 60) return { letter: 'B', colorClass: 'text-amber-600 dark:text-amber-500' };
  if (pct >= 50) return { letter: 'C', colorClass: 'text-amber-600 dark:text-amber-500' };
  if (pct >= 40) return { letter: 'D', colorClass: 'text-rose-700 dark:text-rose-600' };
  return { letter: 'F', colorClass: 'text-rose-700 dark:text-rose-600' };
}

function formatOrdinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

export default function PlayerCard({ player, rank, label, positionAverages }: PlayerCardProps) {
  const fullName = `${player.player.first_name} ${player.player.last_name}`;
  const teamName = player.player.team
    ? player.player.team.name
    : 'N/A';
  const teamColors = getTeamColors(player.player.team?.abbreviation);
  const wins = player.gameResults.filter((g) => g.result === 'W');
  const losses = player.gameResults.filter((g) => g.result === 'L');
  const { letter: gradeLetter, colorClass: gradeColorClass } = getTeamGrade(wins.length, losses.length);
  const teamSeason = player.teamSeason;
  const teamSeasonLine = teamSeason
    ? `(${formatOrdinal(teamSeason.seed)} | ${teamSeason.wins}-${teamSeason.losses})`
    : null;

  const useRankingLayout = rank != null || label != null;
  const seasonPts = player.season?.perGame.pts ?? null;
  const seasonTs = player.season?.percentages.ts ?? null;
  const seasonAst = player.season?.perGame.ast ?? null;
  const hotHandDelta =
    seasonPts != null && seasonPts > 0 ? player.pts - seasonPts : null;
  const showHotHand =
    seasonPts != null && seasonPts > 0 && player.pts >= seasonPts * 1.25;
  const positionCategory = getPositionCategory(player.player.position);
  const rawPosition = player.player.position?.trim().toUpperCase();
  const positionLabel =
    rawPosition === 'G'
      ? 'guard'
      : rawPosition === 'F' || rawPosition === 'G-F' || rawPosition === 'F-G'
        ? 'wing'
        : rawPosition === 'C' || rawPosition === 'F-C' || rawPosition === 'C-F'
          ? 'big'
          : 'player';
  const averageCategory =
    rawPosition === 'F' || rawPosition === 'G-F' || rawPosition === 'F-G'
      ? 'forward'
      : rawPosition === 'C' || rawPosition === 'F-C' || rawPosition === 'C-F'
        ? 'center'
        : positionCategory;
  const positionAverageTs = averageCategory ? positionAverages?.averages?.[averageCategory] ?? null : null;
  const tsDelta = seasonTs != null ? player.ts - seasonTs : null;
  const showTsHotHand =
    seasonTs != null && player.ts - seasonTs >= 5 && player.ts >= 60;
  const ultraEfficientDelta =
    positionAverageTs != null ? player.ts - positionAverageTs : null;
  const ultraEfficientDeltaText =
    ultraEfficientDelta != null ? ultraEfficientDelta.toFixed(1) : '0.0';
  const showUltraEfficient =
    !showTsHotHand &&
    player.pts >= 15 &&
    player.ts >= 65 &&
    averageCategory != null &&
    positionAverageTs != null &&
    ultraEfficientDelta != null &&
    ultraEfficientDelta >= 0;
  const astDelta =
    seasonAst != null && seasonAst > 0 ? player.ast - seasonAst : null;
  const showMakingPlays = astDelta != null && astDelta > 2;
  const seasonReb = player.season?.perGame.reb ?? null;
  const rebDelta =
    seasonReb != null && seasonReb > 0 ? player.reb - seasonReb : null;
  const showBoardMan = rebDelta != null && rebDelta > 2;
  const threesPerGame = player.games > 0 ? player.totalFg3m / player.games : 0;
  const showSniper = threesPerGame > 3;

  const badgeContent = showHotHand || showTsHotHand || showUltraEfficient || showMakingPlays || showBoardMan || showSniper ? (
    <div className="mt-4 inline-block bg-accent/20 px-3 py-2 text-[clamp(0.75rem,0.35vw+0.7rem,0.82rem)]">
      <div className="text-foreground-muted uppercase tracking-[0.2em] text-[0.6rem]">
        TRENDING UP
      </div>
      <div className="mt-2 grid gap-1.5">
        {showHotHand && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-foreground">Getting Buckets</span>
            <span className="font-semibold text-positive">
              <span className="text-[0.6rem] align-baseline">▲</span> {hotHandDelta?.toFixed(1)} pts
            </span>
          </div>
        )}
        {showMakingPlays && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-foreground">Making Plays</span>
            <span className="font-semibold text-positive">
              <span className="text-[0.6rem] align-baseline">▲</span> {astDelta?.toFixed(1)} ast
            </span>
          </div>
        )}
        {showBoardMan && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-foreground">Board Man</span>
            <span className="font-semibold text-positive">
              <span className="text-[0.6rem] align-baseline">▲</span> {rebDelta?.toFixed(1)} reb
            </span>
          </div>
        )}
        {showSniper && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-foreground">Sniper</span>
            <span className="font-semibold text-positive">
              {player.totalFg3m.toFixed(0)} 3s
            </span>
          </div>
        )}
        {showTsHotHand && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-foreground">Hot Hand</span>
            <span className="font-semibold text-positive">
              <span className="text-[0.6rem] align-baseline">▲</span> {tsDelta?.toFixed(1)}% TS
            </span>
          </div>
        )}
        {showUltraEfficient && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-foreground">Ultra Efficient</span>
            <span className="font-semibold text-positive">
              <span className="text-[0.6rem] align-baseline">▲</span> {ultraEfficientDeltaText}% TS relative to avg {positionLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  ) : null;

  const rankingStatsContent = (
    <div>
      <div className="text-foreground-muted uppercase tracking-[0.18em] text-[0.6rem]">averaged</div>
      <div className="flex gap-x-6">
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
              "ml-1 font-bold text-[clamp(1rem,2vw+0.75rem,1.25rem)] " +
              (player.plusMinus > 0
                ? "text-positive"
                : "")
            }
          >
            {player.plusMinus > 0 ? `+${player.plusMinus.toFixed(0)}` : player.plusMinus.toFixed(0)}
          </span>
          {" "}in {Math.round(player.totalMinutes)} minutes
        </span>
      </div>
    </div>
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
      className={`flex items-baseline gap-2 font-sans text-sm font-normal sm:text-base ${teamPlClass}`.trim()}
      style={teamColors ? { color: teamColors.primary } : { color: 'var(--foreground-muted)' }}
    >
      <span className="italic">{teamName}</span>
      {teamSeasonLine && (
        <span className="text-[clamp(0.56rem,0.26vw+0.52rem,0.66rem)] not-italic">
          {teamSeasonLine}
        </span>
      )}
    </div>
  );

  return (
    <div className="relative rounded-lg bg-background py-6 sm:py-8 noise-overlay">
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-2 text-xs text-foreground-muted">
          NBA: {getNbaPlayerId(player.player.id)}
          {player.perAdjusted != null ? (
            <> · PER: {player.perAdjusted.toFixed(1)}</>
          ) : (
            <> · PER: {player.per.toFixed(1)}</>
          )}
        </div>
      )}
      {useRankingLayout ? (
        <>
          {label != null && rank == null && (
            <div className="mb-4 rounded-none bg-foreground px-3 py-2 font-sans text-xl font-medium text-background">
              {label}
            </div>
          )}
          <div
            className="relative sm:min-h-[var(--photo-size)]"
            style={
              {
                '--photo-size': '300px',
                '--photo-gap': '0rem',
              } as React.CSSProperties
            }
          >
            <div className="relative mx-auto h-[300px] w-full max-w-[300px] sm:absolute sm:left-0 sm:top-0 sm:h-[var(--photo-size)] sm:w-[var(--photo-size)]">
              <a
                href={player.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute left-0 top-0 h-[300px] w-[300px] overflow-hidden rounded-full sm:h-[var(--photo-size)] sm:w-[var(--photo-size)]"
                aria-label={`View ${fullName} on NBA.com`}
              >
                <Image
                  src={player.imageUrl || '/placeholder-player.svg'}
                  alt={fullName}
                  fill
                  className="object-cover grayscale"
                />
              </a>
              {rank != null && (
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
              )}
            </div>
            <div className="text-left pl-0 sm:pl-[calc(var(--photo-size)+var(--photo-gap)-1rem)] sm:pt-2">
              <div className="mt-8 sm:pl-0 flex flex-col gap-1 sm:mt-0 sm:-ml-8">
                {rankingNameBlock}
                {rankingTeamBlock('pl-8')}
              </div>
              <div className="mt-6 pl-8 sm:pl-14">
                {rankingStatsContent}
                {badgeContent && <div className="mt-6">{badgeContent}</div>}
              </div>
            </div>
          </div>
          <div className="note-card mt-8 sm:mt-12">
            <NoteCardBorder borderColor={teamColors?.primary ?? '#1a1a1a'}>
              <div className="col-span-2 mb-2 flex items-baseline">
                <span className="mr-2 font-serif text-lg font-bold text-foreground">Team Weekly Grade: </span>
                <span className={`font-sans text-xl font-bold ${gradeColorClass}`}>{gradeLetter}</span>
              </div>
              <div className="pr-4">
                  <p className="mb-1 font-sans text-[0.65rem] font-bold uppercase tracking-[0.2em] text-positive opacity-75">
                    {wins.length === 1 ? '1 Win' : `${wins.length} Wins`}
                  </p>
                  <div className="space-y-1 font-sans">
                    {wins.map((game, index) => (
                      <GameResultRow key={index} game={game} />
                    ))}
                  </div>
                </div>
                <div className="pr-4">
                  <p className="mb-1 font-sans text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-700 opacity-75 dark:text-rose-600">
                    {losses.length === 1 ? '1 Loss' : `${losses.length} Losses`}
                  </p>
                  <div className="space-y-1 font-sans">
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
                  className="flex items-baseline gap-2 text-xl"
                  style={
                    teamColors
                      ? { color: teamColors.primary, opacity: 0.9 }
                      : { color: 'var(--foreground-muted)' }
                  }
                >
                  <span className="italic">{teamName}</span>
                  {teamSeasonLine && (
                    <span className="text-[clamp(0.56rem,0.26vw+0.52rem,0.66rem)] not-italic">
                      {teamSeasonLine}
                    </span>
                  )}
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
              {badgeContent}
            </div>
            <div className="note-card mt-4">
              <NoteCardBorder borderColor={teamColors?.primary ?? '#1a1a1a'}>
                <div className="col-span-2 mb-2 flex items-baseline">
                <span className="mr-2 font-serif text-lg font-bold text-foreground">Team Weekly Grade: </span>
                  <span className={`font-sans text-lg font-bold ${gradeColorClass}`}>{gradeLetter}</span>
                </div>
              <div className="pr-4">
                  <p className="mb-1 font-sans text-[0.65rem] font-bold uppercase tracking-[0.2em] text-positive opacity-75">
                    {wins.length === 1 ? '1 Win' : `${wins.length} Wins`}
                  </p>
                  <div className="space-y-1 font-sans">
                    {wins.map((game, index) => (
                      <GameResultRow key={index} game={game} />
                    ))}
                  </div>
                </div>
                <div className="pr-4">
                  <p className="mb-1 font-sans text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-700 opacity-75 dark:text-rose-600">
                    {losses.length === 1 ? '1 Loss' : `${losses.length} Losses`}
                  </p>
                  <div className="space-y-1 font-sans">
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
  const opponentName = game.opponent.nickname ?? game.opponent.name ?? game.opponent.abbreviation;
  const scoreText = `${game.playerTeamScore}-${game.opponentScore}`;
  const comeback = game.comebackInfo;

  return (
    <div className="font-sans text-foreground text-[clamp(0.8125rem,0.45vw+0.78rem,0.95rem)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[clamp(0.78rem,0.42vw+0.74rem,0.9rem)] text-foreground-muted">{opponentName}</span>
        <span className="ml-auto text-right font-bold text-foreground-muted tabular-nums text-[clamp(0.72rem,0.4vw+0.68rem,0.85rem)]">
          {scoreText}
        </span>
      </div>
      {comeback && (
        <div className="text-muted-foreground text-[clamp(0.75rem,0.4vw+0.7rem,0.875rem)]">
          (comeback from down {comeback.deficit} after {comeback.afterQuarters} quarter{comeback.afterQuarters === 1 ? "" : "s"})
        </div>
      )}
    </div>
  );
}
