export interface RateLimiterOptions {
  maxRequests?: number;
  windowMs?: number;
}

const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_WINDOW_MS = 60000; // 1 minute

export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private totalWaitTime = 0; // Track for debug

  constructor(options?: RateLimiterOptions) {
    this.maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
    this.windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    // Remove requests older than 1 minute
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );

    if (this.requests.length >= this.maxRequests) {
      // Calculate wait time until oldest request expires
      const oldest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldest) + 100; // +100ms buffer
      this.totalWaitTime += waitTime;

      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Re-filter after waiting
      const newNow = Date.now();
      this.requests = this.requests.filter(
        time => newNow - time < this.windowMs
      );
    }

    this.requests.push(Date.now());
  }

  getTotalWaitTime(): number {
    return this.totalWaitTime;
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );
    return this.maxRequests - this.requests.length;
  }
}
