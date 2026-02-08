import type { RateLimiter } from './rateLimiter';
import { logEvent } from './logger';

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  rateLimiter: RateLimiter,
  maxRetries = 5
): Promise<Response> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt += 1;
    await rateLimiter.acquire(1);
    const response = await fetch(url, options);

    if (response.status === 429 || response.status === 529) {
      const retryAfter = response.headers.get('retry-after');
      let waitMs: number;
      if (retryAfter) {
        const retrySeconds = Number(retryAfter);
        waitMs = Number.isFinite(retrySeconds)
          ? retrySeconds * 1000
          : 2000;
      } else {
        const base = Math.min(60, Math.pow(2, attempt)) * 1000;
        const jitter = Math.floor(Math.random() * 250);
        waitMs = base + jitter;
      }

      logEvent('warn', 'rate_limit_retry', {
        url,
        status: response.status,
        attempt,
        wait_ms: waitMs,
        retry_after: retryAfter ?? null,
      });

      if (attempt > maxRetries) {
        return response;
      }

      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }

    return response;
  }

  return fetch(url, options);
}
