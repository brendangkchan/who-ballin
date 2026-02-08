export type RateLimiter = {
  acquire: (tokens?: number) => Promise<void>;
};

export function createTokenBucket(options: {
  capacity: number;
  refillPerSecond: number;
  onWait?: (waitMs: number) => void;
}): RateLimiter {
  let tokens = options.capacity;
  let lastRefill = Date.now();

  function refill() {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    if (elapsed <= 0) return;
    tokens = Math.min(options.capacity, tokens + elapsed * options.refillPerSecond);
    lastRefill = now;
  }

  async function acquire(requestTokens = 1) {
    while (true) {
      refill();
      if (tokens >= requestTokens) {
        tokens -= requestTokens;
        return;
      }
      const needed = requestTokens - tokens;
      const waitSeconds = needed / options.refillPerSecond;
      const waitMs = Math.max(50, Math.ceil(waitSeconds * 1000));
      options.onWait?.(waitMs);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  return { acquire };
}
