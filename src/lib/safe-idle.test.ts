import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runChunked, safeIdle, yieldToMain } from "./safe-idle";

type RicHandle = number;

interface Harness {
  pending: Array<{ callback: () => void; handle: RicHandle }>;
  fire: (handle: RicHandle) => void;
}

/**
 * The suite runs in the node environment (no `window`). Point `window` at
 * `globalThis` so the rIC code paths are reachable, and remember whether we
 * created it so afterEach can restore the SSR-like absence of `window`.
 */
let createdWindow = false;

function ensureWindow(): typeof globalThis {
  if (typeof (globalThis as { window?: unknown }).window === "undefined") {
    (globalThis as { window?: unknown }).window = globalThis;
    createdWindow = true;
  }
  return globalThis;
}

/**
 * Installs a controllable requestIdleCallback stub. Each scheduled callback
 * gets a deadline that never expires, mirroring a cooperative idle window.
 */
function installRicHarness(): Harness {
  const w = ensureWindow() as unknown as Record<string, unknown>;
  const pending: Array<{ callback: () => void; handle: RicHandle }> = [];
  let nextHandle = 1;
  w.requestIdleCallback = vi.fn(
    (callback: () => void, _opts?: { timeout: number }) => {
      const handle = nextHandle++;
      pending.push({ callback, handle });
      return handle;
    },
  );
  w.cancelIdleCallback = vi.fn((handle: RicHandle) => {
    const i = pending.findIndex((p) => p.handle === handle);
    if (i !== -1) pending.splice(i, 1);
  });
  return {
    pending,
    fire: (handle) => {
      const i = pending.findIndex((p) => p.handle === handle);
      if (i === -1) throw new Error(`no pending callback ${handle}`);
      const [{ callback }] = pending.splice(i, 1);
      callback();
    },
  };
}

/** rIC stub that fires synchronously via microtask (for runChunked tests). */
function installInstantRic() {
  const w = ensureWindow() as unknown as Record<string, unknown>;
  let handle = 0;
  w.requestIdleCallback = vi.fn((callback: () => void) => {
    handle += 1;
    queueMicrotask(() => callback());
    return handle;
  });
  w.cancelIdleCallback = vi.fn();
  const now = vi.spyOn(performance, "now");
  let t = 0;
  now.mockImplementation(() => {
    t += 3; // 3ms per onChunk call, under the 8ms default budget
    return t;
  });
  return () => now.mockRestore();
}

function removeRicStubs() {
  const w = globalThis as unknown as Record<string, unknown>;
  delete w.requestIdleCallback;
  delete w.cancelIdleCallback;
  if (createdWindow) {
    delete (globalThis as { window?: unknown }).window;
    createdWindow = false;
  }
}

describe("safeIdle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    removeRicStubs();
  });

  it("uses requestIdleCallback and returns a cancel that reaches cancelIdleCallback", () => {
    const harness = installRicHarness();
    const spy = vi.fn();
    safeIdle(spy, { timeout: 500 });

    expect(window.requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();

    harness.fire(1);
    expect(spy).toHaveBeenCalledTimes(1);

    safeIdle(vi.fn())();
    expect(window.cancelIdleCallback).toHaveBeenCalled();
  });

  it("falls back to setTimeout honoring the timeout without rIC (Safari-like)", () => {
    // No rIC installed: `window` exists but requestIdleCallback is missing.
    ensureWindow();
    const spy = vi.fn();
    safeIdle(spy, { timeout: 750 });
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(749);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("cancel prevents the fallback setTimeout from firing", () => {
    ensureWindow();
    const spy = vi.fn();
    const cancel = safeIdle(spy, { timeout: 100 });
    cancel();
    vi.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
  });

  it("runs the callback via setTimeout when window is undefined (SSR)", () => {
    const spy = vi.fn();
    delete (globalThis as { window?: unknown }).window;
    createdWindow = false;
    const cancel = safeIdle(spy, { timeout: 50 });
    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledTimes(1);
    cancel();
  });
});

describe("runChunked", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    removeRicStubs();
  });

  it("processes all items across chunked idle slices and calls onDone once", async () => {
    installRicHarness();
    const restoreNow = installInstantRic();
    const seen: number[] = [];

    runChunked([1, 2, 3, 4, 5], {
      onChunk: (slice) => seen.push(...slice),
      onDone: () => seen.push(-1),
    });
    await vi.waitFor(() => expect(seen).toEqual([1, 2, 3, 4, 5, -1]));
    restoreNow();
  });

  it("always runs onDone when cancelled mid-run", async () => {
    installRicHarness();
    installInstantRic();
    const seen: number[] = [];
    let slices = 0;
    // A 1ms budget against the fake 3ms clock forces exactly one chunk per
    // idle slice, so the run is genuinely still in progress when cancelled.
    const cancel = runChunked([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
      budgetMs: 1,
      onChunk: () => {
        slices += 1;
      },
      onDone: () => seen.push(-1),
    });
    await Promise.resolve(); // flush the first idle slice
    expect(slices).toBe(1);
    expect(seen).toEqual([]);
    cancel();
    await vi.waitFor(() => expect(seen).toEqual([-1]));
    expect(slices).toBe(1);
  });
});

describe("yieldToMain", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves via scheduler.yield when available", async () => {
    const yieldFn = vi.fn(async () => {});
    vi.stubGlobal("scheduler", { yield: yieldFn });
    await yieldToMain();
    expect(yieldFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to setTimeout when scheduler is missing", async () => {
    vi.stubGlobal("scheduler", undefined);
    await expect(yieldToMain()).resolves.toBeUndefined();
  });
});
