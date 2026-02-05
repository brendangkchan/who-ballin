'use client';

import { useState } from 'react';

interface RefreshButtonProps {
  onRefresh: () => Promise<void>;
}

export default function RefreshButton({ onRefresh }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/players/refresh', { method: 'POST' });
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:opacity-90 disabled:opacity-50"
    >
      {isRefreshing ? 'Refreshing...' : 'Refresh'}
    </button>
  );
}
