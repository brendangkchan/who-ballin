'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DEFAULT_MIN_GAMES, DEFAULT_MIN_PTS, DEFAULT_MIN_MINUTES } from '@/lib/filters';

export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [minGames, setMinGames] = useState(searchParams.get('minGames') ?? String(DEFAULT_MIN_GAMES));
  const [minPts, setMinPts] = useState(searchParams.get('minPts') ?? String(DEFAULT_MIN_PTS));
  const [minMinutes, setMinMinutes] = useState(searchParams.get('minMinutes') ?? String(DEFAULT_MIN_MINUTES));

  useEffect(() => {
    setMinGames(searchParams.get('minGames') ?? String(DEFAULT_MIN_GAMES));
    setMinPts(searchParams.get('minPts') ?? String(DEFAULT_MIN_PTS));
    setMinMinutes(searchParams.get('minMinutes') ?? String(DEFAULT_MIN_MINUTES));
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    const mg = minGames || String(DEFAULT_MIN_GAMES);
    const mp = minPts || String(DEFAULT_MIN_PTS);
    const mm = minMinutes || String(DEFAULT_MIN_MINUTES);
    if (mg !== String(DEFAULT_MIN_GAMES)) params.set('minGames', mg);
    if (mp !== String(DEFAULT_MIN_PTS)) params.set('minPts', mp);
    if (mm !== String(DEFAULT_MIN_MINUTES)) params.set('minMinutes', mm);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 py-4">
      <FilterLabel label="Min games">
        <input
          type="number"
          name="minGames"
          min={0}
          value={minGames}
          onChange={(e) => setMinGames(e.target.value)}
          className="w-20 rounded border border-border bg-background px-2 py-1.5 text-foreground"
        />
      </FilterLabel>
      <FilterLabel label="Min pts">
        <input
          type="number"
          name="minPts"
          min={0}
          value={minPts}
          onChange={(e) => setMinPts(e.target.value)}
          className="w-20 rounded border border-border bg-background px-2 py-1.5 text-foreground"
        />
      </FilterLabel>
      <FilterLabel label="Min minutes">
        <input
          type="number"
          name="minMinutes"
          min={0}
          value={minMinutes}
          onChange={(e) => setMinMinutes(e.target.value)}
          className="w-20 rounded border border-border bg-background px-2 py-1.5 text-foreground"
        />
      </FilterLabel>
      <button
        type="submit"
        className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:opacity-90"
      >
        Apply
      </button>
    </form>
  );
}

function FilterLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground-muted">
        <span className="h-4 w-1 shrink-0 bg-accent" aria-hidden />
        {label}
      </span>
      {children}
    </label>
  );
}
