import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBatcher } from "./batcher";

describe("RequestBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("flushes after delayMs elapses", async () => {
    const batchFn = vi.fn(async (items: number[]) => items.map((i) => i * 2));
    const batcher = createBatcher(batchFn, { delayMs: 50, maxWaitMs: 5000 });

    const p1 = batcher.schedule(1);
    const p2 = batcher.schedule(2);
    expect(batchFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    expect(batchFn).toHaveBeenCalledWith([1, 2]);
    await expect(p1).resolves.toBe(2);
    await expect(p2).resolves.toBe(4);
  });

  it("flushes immediately on maxBatchSize even before the delay", async () => {
    const batchFn = vi.fn(async (items: number[]) => items);
    const batcher = createBatcher(batchFn, {
      delayMs: 1000,
      maxWaitMs: 5000,
      maxBatchSize: 2,
    });

    const p1 = batcher.schedule(10);
    const p2 = batcher.schedule(20);
    expect(batchFn).toHaveBeenCalledWith([10, 20]);
    await expect(p1).resolves.toBe(10);
    await expect(p2).resolves.toBe(20);
  });

  it("flushes on maxWaitMs even when the delay keeps re-arming", async () => {
    const batchFn = vi.fn(async (items: number[]) => items);
    const batcher = createBatcher(batchFn, {
      delayMs: 2000,
      maxWaitMs: 300,
    });

    const p1 = batcher.schedule(1);
    await vi.advanceTimersByTimeAsync(300);
    expect(batchFn).toHaveBeenCalledWith([1]);
    await expect(p1).resolves.toBe(1);
  });

  it("dedupes by key and resolves both callers with the newest result", async () => {
    const batchFn = vi.fn(async (items: { id: string; v: number }[]) => items);
    const batcher = createBatcher(batchFn, {
      delayMs: 50,
      maxWaitMs: 5000,
      getKey: (item) => item.id,
    });

    const p1 = batcher.schedule({ id: "a", v: 1 });
    const p2 = batcher.schedule({ id: "a", v: 2 });
    await vi.advanceTimersByTimeAsync(50);

    expect(batchFn).toHaveBeenCalledTimes(1);
    expect(batchFn).toHaveBeenCalledWith([{ id: "a", v: 2 }]);
    // Both the original and the replacement caller resolve with the newest
    // item's result (latest intent wins).
    await expect(p1).resolves.toEqual({ id: "a", v: 2 });
    await expect(p2).resolves.toEqual({ id: "a", v: 2 });
  });

  it("rejects every caller when the batch fn fails", async () => {
    const error = new Error("backend exploded");
    const batchFn = vi.fn(async () => {
      throw error;
    });
    const batcher = createBatcher(batchFn, {
      delayMs: 50,
      maxWaitMs: 5000,
    });

    const p1 = batcher.schedule(1);
    const p2 = batcher.schedule(2);
    const results = Promise.allSettled([p1, p2]);
    await vi.advanceTimersByTimeAsync(50);

    const settled = await results;
    expect(settled).toEqual([
      { status: "rejected", reason: error },
      { status: "rejected", reason: error },
    ]);
  });

  it("rejects every caller when the batch fn returns the wrong length", async () => {
    const batchFn = vi.fn(async () => ["only-one"]);
    const batcher = createBatcher(batchFn, {
      delayMs: 50,
      maxWaitMs: 5000,
    });

    const p1 = batcher.schedule(1);
    const p2 = batcher.schedule(2);
    const results = Promise.allSettled([p1, p2]);
    await vi.advanceTimersByTimeAsync(50);

    const settled = await results;
    expect(settled[0]?.status).toBe("rejected");
    expect(settled[1]?.status).toBe("rejected");
    if (settled[0]?.status === "rejected") {
      expect(settled[0].reason.message).toMatch(/returned 1 results/);
    }
    if (settled[1]?.status === "rejected") {
      expect(settled[1].reason.message).toMatch(/returned 1 results/);
    }
  });

  it("flush on an empty queue is a no-op", async () => {
    const batchFn = vi.fn(async (items: number[]) => items);
    const batcher = createBatcher(batchFn);
    await batcher.flush();
    await vi.advanceTimersByTimeAsync(10);
    expect(batchFn).not.toHaveBeenCalled();
  });

  it("clear() drops the queue and timers", async () => {
    const batchFn = vi.fn(async (items: number[]) => items);
    const batcher = createBatcher(batchFn, { delayMs: 50, maxWaitMs: 5000 });
    batcher.schedule(1);
    batcher.clear();
    await vi.advanceTimersByTimeAsync(200);
    expect(batchFn).not.toHaveBeenCalled();
  });
});
