export type BatcherOptions<TItem> = {
  delayMs?: number;
  maxWaitMs?: number;
  maxBatchSize?: number;
  getKey?: (item: TItem) => string;
  flushOnPageHide?: boolean;
};

/**
 * Coalesces synchronous bursts of work into deferred batch calls.
 *
 * Behaviour contracts (pinned by unit tests — do not change silently):
 *
 * - **Dedupe resolution.** When `getKey` is set, re-scheduling an item with a
 *   key already in the queue REPLACES the queued item, and resolves BOTH the
 *   original caller and the new caller with the result of the NEWEST item.
 *   The batch that runs therefore contains one entry per key (latest intent
 *   wins), mirroring the server's per-item deduplication semantics.
 * - **Batch failure.** If `batchFn` rejects or returns a mismatched length,
 *   every caller in the batch is rejected with the same error; nothing is
 *   partially applied. Callers rely on their query's refetch to reconcile.
 * - **Flush triggers.** The batch runs when the queue reaches `maxBatchSize`,
 *   when `delayMs` elapses since scheduling, or when `maxWaitMs` elapses since
 *   the FIRST item in the queue (whichever comes first). `flush()` may also be
 *   called manually; a flush on an empty queue is a no-op.
 * - **Fresh promise, same resolve.** Once flushed, queued callers are
 *   untracked; the timer state resets on flush and clear().
 */
export class RequestBatcher<TItem, TResult = unknown> {
  private queue: Array<{
    item: TItem;
    resolve: (val: TResult) => void;
    reject: (err: unknown) => void;
  }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstItemTime: number | null = null;
  private batchFn: (items: TItem[]) => Promise<TResult[]>;
  private delayMs: number;
  private maxWaitMs: number;
  private maxBatchSize: number;
  private getKey?: (item: TItem) => string;
  private handlePageHide: (() => void) | null = null;
  private handleVisibilityChange: (() => void) | null = null;

  constructor(
    batchFn: (items: TItem[]) => Promise<TResult[]>,
    options?: BatcherOptions<TItem>,
  ) {
    this.batchFn = batchFn;
    this.delayMs = options?.delayMs ?? 300;
    this.maxWaitMs = options?.maxWaitMs ?? 1200;
    this.maxBatchSize = options?.maxBatchSize ?? 100;
    this.getKey = options?.getKey;

    if (options?.flushOnPageHide && typeof document !== "undefined") {
      this.handlePageHide = () => {
        void this.flush();
      };
      this.handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          void this.flush();
        }
      };
      window.addEventListener("pagehide", this.handlePageHide);
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );
    }
  }

  schedule(item: TItem): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      if (this.getKey) {
        const getKeyFn = this.getKey;
        const key = getKeyFn(item);
        const existingIndex = this.queue.findIndex(
          (entry) => getKeyFn(entry.item) === key,
        );
        if (existingIndex !== -1) {
          const prev = this.queue[existingIndex];
          this.queue[existingIndex] = {
            item,
            resolve: (val) => {
              prev.resolve(val);
              resolve(val);
            },
            reject: (err) => {
              prev.reject(err);
              reject(err);
            },
          };
          this.scheduleTimer();
          return;
        }
      }

      this.queue.push({ item, resolve, reject });

      if (this.queue.length >= this.maxBatchSize) {
        void this.flush();
      } else {
        this.scheduleTimer();
      }
    });
  }

  private scheduleTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const now = Date.now();
    if (!this.firstItemTime) {
      this.firstItemTime = now;
    }

    const timeSinceFirst = now - this.firstItemTime;
    const remainingMaxWait = Math.max(0, this.maxWaitMs - timeSinceFirst);
    const waitTime = Math.min(this.delayMs, remainingMaxWait);

    this.timer = setTimeout(() => {
      void this.flush();
    }, waitTime);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.firstItemTime = null;

    if (this.queue.length === 0) return;

    const currentBatch = this.queue;
    this.queue = [];

    const items = currentBatch.map((entry) => entry.item);

    try {
      const result = await this.batchFn(items);
      if (result.length !== currentBatch.length) {
        throw new Error(
          `RequestBatcher: batchFn returned ${result.length} results for ${currentBatch.length} items`,
        );
      }
      for (let i = 0; i < currentBatch.length; i++) {
        currentBatch[i].resolve(result[i]);
      }
    } catch (error) {
      for (const entry of currentBatch) {
        entry.reject(error);
      }
    }
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.firstItemTime = null;
    this.queue = [];
  }

  dispose(): void {
    if (typeof window !== "undefined" && this.handlePageHide) {
      window.removeEventListener("pagehide", this.handlePageHide);
      this.handlePageHide = null;
    }
    if (typeof document !== "undefined" && this.handleVisibilityChange) {
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );
      this.handleVisibilityChange = null;
    }
    this.clear();
  }
}

export function createBatcher<TItem, TResult = unknown>(
  batchFn: (items: TItem[]) => Promise<TResult[]>,
  options?: BatcherOptions<TItem>,
): RequestBatcher<TItem, TResult> {
  return new RequestBatcher(batchFn, options);
}
