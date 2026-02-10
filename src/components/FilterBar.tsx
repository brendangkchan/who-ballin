'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DEFAULT_MIN_GAMES,
  DEFAULT_MIN_PTS,
  DEFAULT_MIN_MINUTES,
  MIN_MIN_GAMES,
  MIN_MIN_MINUTES,
} from '@/lib/filters';

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [minGames, setMinGames] = useState(
    String(coerceMin(searchParams.get('minGames') ?? '', DEFAULT_MIN_GAMES, MIN_MIN_GAMES))
  );
  const [minPts, setMinPts] = useState(
    String(coerceMin(searchParams.get('minPts') ?? '', DEFAULT_MIN_PTS, 0))
  );
  const [minMinutes, setMinMinutes] = useState(
    String(coerceMin(searchParams.get('minMinutes') ?? '', DEFAULT_MIN_MINUTES, MIN_MIN_MINUTES))
  );

  useEffect(() => {
    setMinGames(
      String(coerceMin(searchParams.get('minGames') ?? '', DEFAULT_MIN_GAMES, MIN_MIN_GAMES))
    );
    setMinPts(String(coerceMin(searchParams.get('minPts') ?? '', DEFAULT_MIN_PTS, 0)));
    setMinMinutes(
      String(
        coerceMin(
          searchParams.get('minMinutes') ?? '',
          DEFAULT_MIN_MINUTES,
          MIN_MIN_MINUTES
        )
      )
    );
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    const mgVal = coerceMin(minGames, DEFAULT_MIN_GAMES, MIN_MIN_GAMES);
    const mpVal = coerceMin(minPts, DEFAULT_MIN_PTS, 0);
    const mmVal = coerceMin(minMinutes, DEFAULT_MIN_MINUTES, MIN_MIN_MINUTES);
    if (mgVal !== DEFAULT_MIN_GAMES) params.set('minGames', String(mgVal));
    if (mpVal !== DEFAULT_MIN_PTS) params.set('minPts', String(mpVal));
    if (mmVal !== DEFAULT_MIN_MINUTES) params.set('minMinutes', String(mmVal));
    const qs = params.toString();
    const base = pathname || '/';
    router.push(qs ? `${base}?${qs}` : base);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 py-4">
      <FilterLabel label="Games">
        <input
          type="number"
          name="minGames"
          min={MIN_MIN_GAMES}
          value={minGames}
          onChange={(e) => setMinGames(e.target.value)}
          className="w-20 rounded border border-border bg-background px-2 py-1.5 text-foreground text-[clamp(0.75rem,1vw+0.7rem,0.875rem)]"
        />
      </FilterLabel>
      <FilterLabel label="Points">
        <input
          type="number"
          name="minPts"
          min={0}
          value={minPts}
          onChange={(e) => setMinPts(e.target.value)}
          className="w-20 rounded border border-border bg-background px-2 py-1.5 text-foreground text-[clamp(0.75rem,1vw+0.7rem,0.875rem)]"
        />
      </FilterLabel>
      <FilterLabel label="Minutes">
        <input
          type="number"
          name="minMinutes"
          min={MIN_MIN_MINUTES}
          value={minMinutes}
          onChange={(e) => setMinMinutes(e.target.value)}
          className="w-20 rounded border border-border bg-background px-2 py-1.5 text-foreground text-[clamp(0.75rem,1vw+0.7rem,0.875rem)]"
        />
      </FilterLabel>
      <button
        type="submit"
        className="rounded bg-accent px-4 py-1.5 font-medium text-foreground transition-colors hover:opacity-90 text-[clamp(0.75rem,1vw+0.7rem,0.875rem)]"
      >
        Apply
      </button>
    </form>
  );
}

function FilterLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-2 font-medium text-foreground-muted text-[clamp(0.75rem,1vw+0.7rem,0.875rem)]">
        <span className="h-4 w-1 shrink-0 bg-accent" aria-hidden />
        {label}
      </span>
      {children}
    </label>
  );
}

function coerceMin(value: string, fallback: number, minVal: number): number {
  if (value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(parsed, minVal);
}
