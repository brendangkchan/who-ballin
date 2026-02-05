'use client';

import { useState } from 'react';
import type { DebugInfo } from '@/types/player';

interface DebugPanelProps {
  debugInfo: DebugInfo;
}

export default function DebugPanel({ debugInfo }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Debug info is only sent from server in development, so this component
  // will only render in dev environments

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg bg-red-500 px-4 py-2 text-white shadow-lg hover:bg-red-600"
      >
        {isOpen ? 'Hide' : 'Show'} Debug
      </button>

      {isOpen && (
        <div className="mt-2 max-h-96 w-96 overflow-y-auto rounded-lg border-2 border-red-500 bg-white p-4 shadow-lg dark:bg-zinc-900">
          <h3 className="mb-2 font-bold text-red-600">Debug Information</h3>

          <section className="mb-4">
            <h4 className="font-semibold">Requests</h4>
            <p className="text-sm">Total: {debugInfo.requests}</p>
            <p className="text-sm">Batches: {debugInfo.batchCount}</p>
            <p className="text-sm">
              Rate limit delays: {debugInfo.rateLimitDelays}ms
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm">API Calls</summary>
              <ul className="mt-1 space-y-1 text-xs">
                {debugInfo.apiCalls.map((call, i) => (
                  <li key={i} className="border-b border-zinc-200 pb-1">
                    <span className="font-mono">{call.endpoint}</span> -{' '}
                    <span
                      className={
                        call.status === 200
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {call.status}
                    </span>{' '}
                    ({call.duration}ms)
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className="mb-4">
            <h4 className="font-semibold">Data Processing</h4>
            <p className="text-sm">Games: {debugInfo.gamesProcessed}</p>
            <p className="text-sm">Stats: {debugInfo.statsProcessed}</p>
            <p className="text-sm">Players: {debugInfo.playersFound}</p>
          </section>

          <section className="mb-4">
            <h4 className="font-semibold">Date Range</h4>
            <p className="text-sm">Start: {debugInfo.dateRange.start}</p>
            <p className="text-sm">End: {debugInfo.dateRange.end}</p>
            {debugInfo.dateRange.usedFallback && (
              <p className="text-sm text-yellow-600">
                ⚠ Used fallback date range
              </p>
            )}
          </section>

          <section className="mb-4">
            <h4 className="font-semibold">Performance</h4>
            <p className="text-sm">
              Processing time: {debugInfo.processingTime}ms
            </p>
            <p className="text-sm">
              Cache: {debugInfo.cacheHit ? 'HIT' : 'MISS'}
            </p>
          </section>

          {debugInfo.errors.length > 0 && (
            <section className="mb-4">
              <h4 className="font-semibold text-red-600">Errors</h4>
              <ul className="space-y-1 text-sm">
                {debugInfo.errors.map((error, i) => (
                  <li key={i} className="text-red-600">{error}</li>
                ))}
              </ul>
            </section>
          )}

          {debugInfo.warnings.length > 0 && (
            <section className="mb-4">
              <h4 className="font-semibold text-yellow-600">Warnings</h4>
              <ul className="space-y-1 text-sm">
                {debugInfo.warnings.map((warning, i) => (
                  <li key={i} className="text-yellow-600">{warning}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
