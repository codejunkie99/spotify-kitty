export class AsyncQueue<T> {
  private readonly items: T[] = [];
  private draining = false;
  private idlePromise: Promise<void> | null = null;
  private resolveIdle: (() => void) | null = null;

  public constructor(
    private readonly consume: (item: T) => Promise<void> | void,
  ) {}

  public enqueue(item: T): void {
    this.items.push(item);
    if (!this.idlePromise) {
      this.idlePromise = new Promise<void>((resolve) => {
        this.resolveIdle = resolve;
      });
    }
    if (!this.draining) {
      void this.drain();
    }
  }

  public async onIdle(): Promise<void> {
    await this.idlePromise;
  }

  private async drain(): Promise<void> {
    this.draining = true;
    try {
      while (this.items.length > 0) {
        const next = this.items.shift();
        if (next === undefined) continue;
        await this.consume(next);
      }
    } finally {
      this.draining = false;
      if (this.items.length === 0) {
        this.resolveIdle?.();
        this.resolveIdle = null;
        this.idlePromise = null;
      } else {
        void this.drain();
      }
    }
  }
}
