'use client';

import { useRouter } from 'next/navigation';
import RefreshButton from './RefreshButton';

export default function RefreshButtonWrapper() {
  const router = useRouter();

  const handleRefresh = async () => {
    await fetch('/api/players/refresh', { method: 'POST' });
    router.refresh();
  };

  return <RefreshButton onRefresh={handleRefresh} />;
}
