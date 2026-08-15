/**
 * Privacy-Conscious In-Memory Rate Limiter for VEIL Relay Server.
 *
 * Uses sliding-window counters without persistent tracking.
 * Automatically cleans up expired windows to bound memory usage.
 */

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private requests = new Map<string, number[]>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(windowMs = 60000, maxRequests = 120) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Periodic cleanup of stale tracking entries
    this.cleanupTimer = setInterval(() => this.cleanup(), this.windowMs);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Checks if the given key is currently rate limited.
   *
   * @param key Identifier (e.g. IP address)
   * @returns true if allowed, false if rate limited
   */
  public isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const windowStart = now - this.windowMs;

    // Filter to active window
    const active = timestamps.filter(ts => ts > windowStart);
    if (active.length >= this.maxRequests) {
      return false;
    }

    active.push(now);
    this.requests.set(key, active);
    return true;
  }

  /**
   * Resets limits for a specific key (used in tests).
   */
  public reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }

  /**
   * Cleans up timer and resources on server shutdown.
   */
  public close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.requests.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const active = timestamps.filter(ts => ts > windowStart);
      if (active.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, active);
      }
    }
  }
}
