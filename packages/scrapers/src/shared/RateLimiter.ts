export class RateLimiter {
  private lastRunAt = 0;

  constructor(private readonly delayMs: number) {}

  async wait(): Promise<void> {
    const elapsed = Date.now() - this.lastRunAt;
    const remaining = this.delayMs - elapsed;
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    this.lastRunAt = Date.now();
  }
}
