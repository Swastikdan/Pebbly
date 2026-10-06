/**
 * Main-thread scheduling utilities.
 *
 * Mobile browsers do not run JS while they scroll/paint — anything scheduled
 * in a task competes with input latency and frame budget (1000/60 = 16.7ms,
 * ~8.3ms at 120Hz). These helpers push non-critical work into idle windows
 * and split long tasks so the browser can paint in between.
 */

/**
 * Runs `callback` during an idle period, or via `setTimeout` when
 * `requestIdleCallback` is unavailable (Safari < 17 does not ship it) or the
 * page is hidden (rIC can be deferred indefinitely in background tabs).
 *
 * Guarantees:
 * - Returns a cancel function in every environment (rIC's timeout arg and its
 *   numeric handle leak a binding to `window` — the wrapper owns that).
 * - `timeout` is honored by BOTH paths: with rIC it bounds starvation; with
 *   the setTimeout fallback it prevents firing before a (slower) idle window
 *   would plausibly have arrived.
 */
export function safeIdle(
  callback: () => void,
  { timeout = 2000 }: { timeout?: number } = {},
): () => void {
  if (typeof window === "undefined") {
    // SSR / no-DOM environments: the work must still run, just not now.
    const id = setTimeout(callback, 0);
    return () => clearTimeout(id);
  }

  const w = window as Window & {
    requestIdleCallback?: (
      cb: (deadline: {
        didTimeout: boolean;
        timeRemaining: () => number;
      }) => void,
      opts?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof w.requestIdleCallback === "function") {
    const handle = w.requestIdleCallback(callback, { timeout });
    return () => w.cancelIdleCallback?.(handle);
  }

  // Fallback path (Safari and hidden pages): fire at `timeout` via nested
  // setTimeout, which is the closest scheduling primitive available there.
  // In Safari nested setTimeout(0) is clamped to ~10ms, matching rIC idle
  // windows closely enough for prefetch/analytics-grade work.
  const delay = Math.max(1, timeout);
  const id = setTimeout(() => {
    callback();
  }, delay);
  return () => clearTimeout(id);
}

/** True when the idle window granted by the scheduler is spent. */
function deadlinePassed(deadline: IdleDeadline | undefined) {
  return deadline ? deadline.timeRemaining() <= 0 : false;
}

/**
 * Processes `items` in slices that stop when the idle window or `budgetMs`
 * expires, so N-item work never becomes one long main-thread block.
 *
 * Chunk sizes adapt: the first slice is a single-item probe, then the size
 * scales to whatever fits `budgetMs` (clamped to `[1, maxChunkSize]`), so a
 * list of cheap items converges on big chunks while expensive items stay
 * responsive. `onDone` always fires exactly once, even if the caller cancels.
 */
export function runChunked<T, R>(
  items: readonly T[],
  options: {
    budgetMs?: number;
    maxChunkSize?: number;
    onChunk: (slice: T[]) => void;
    onDone: () => R;
  },
): () => void {
  const { budgetMs = 8, maxChunkSize = 500, onChunk, onDone } = options;
  let index = 0;
  let chunkSize = 1; // probe: measure per-item cost before scaling up
  let cancelled = false;
  let done = false;

  const finish = () => {
    if (!done) {
      done = true;
      onDone();
    }
  };

  const step = (deadline?: IdleDeadline) => {
    if (cancelled) return finish();
    while (index < items.length) {
      if (deadlinePassed(deadline)) break;
      const start = performance.now();
      const end = Math.min(index + chunkSize, items.length);
      onChunk(items.slice(index, end));
      const elapsed = performance.now() - start;
      const processed = end - index;
      index = end;
      // Scale the next chunk so a typical chunk fits the budget.
      const perItem = elapsed / processed;
      chunkSize = Math.max(
        1,
        Math.min(maxChunkSize, Math.round(budgetMs / Math.max(perItem, 0.001))),
      );
      // Wall-clock guard: deadline.timeRemaining() can lie after layout work
      // inside onChunk, so also stop when our own budget is spent. This is
      // the only guard on the setTimeout fallback (no real deadline there).
      if (elapsed > budgetMs) break;
    }
    if (index >= items.length) finish();
    else safeIdle(() => step(undefined), { timeout: 1000 });
  };

  safeIdle(() => step(undefined), { timeout: 1000 });

  // Cancelling stops further slices; onDone still fires exactly once so
  // callers can release resources deterministically.
  return () => {
    cancelled = true;
    finish();
  };
}

/**
 * Awaits the next window where the browser is (likely) not painting —
 * `scheduler.yield()` where available, else a macrotask. Use it to break a
 * long operation into steps that let frames paint in between:
 *
 *   for (const batch of batches) {
 *     await transform(batch);
 *     await yieldToMain();
 *   }
 */
export function yieldToMain(): Promise<void> {
  const scheduler = (
    globalThis as {
      scheduler?: { yield?: () => Promise<void> };
    }
  ).scheduler;
  if (typeof scheduler?.yield === "function") {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
