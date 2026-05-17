// Inline Notion API rate limiter.
//
// The Notion API caps integrations at roughly 3 requests/second. A full demo
// cycle does ~80+ calls in ~30 seconds (queries, updates, block appends, audit
// log) — without throttling, the worker hits 429s mid-demo. The Worker SDK
// does not ship a pacer, so we implement a simple sliding-window limiter.

const DEFAULT_RATE = 3; // requests
const DEFAULT_WINDOW_MS = 1000;

class NotionPacer {
  private timestamps: number[] = [];
  private rate: number;
  private windowMs: number;

  constructor(rate: number = DEFAULT_RATE, windowMs: number = DEFAULT_WINDOW_MS) {
    this.rate = rate;
    this.windowMs = windowMs;
  }

  async wait(): Promise<void> {
    while (true) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
      if (this.timestamps.length < this.rate) {
        this.timestamps.push(now);
        return;
      }
      const oldest = this.timestamps[0];
      const sleepMs = this.windowMs - (now - oldest) + 5; // small safety margin
      await new Promise((r) => setTimeout(r, sleepMs));
    }
  }
}

export const notionPacer = new NotionPacer();
