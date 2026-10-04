import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enqueueMutation,
  getMutationOutboxSnapshot,
} from "@/lib/data/mutation-outbox";
import { syncMutationOutbox } from "@/lib/data/sync-center";

type StorageMock = Storage & { data: Map<string, string> };

function createStorage(): StorageMock {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, value),
  } as StorageMock;
}

describe("mutation sync center", () => {
  let storage: StorageMock;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops after a transient failure and recovers records in order", async () => {
    const firstId = enqueueMutation("user-a", "set-membership", {
      tmdbId: 1,
      mediaType: "movie",
      inWatchlist: true,
    });
    const secondId = enqueueMutation("user-a", "set-membership", {
      tmdbId: 2,
      mediaType: "movie",
      inWatchlist: false,
    });
    const attempted: string[] = [];

    const failedRun = await syncMutationOutbox("user-a", {
      run: async (record) => {
        attempted.push(record.id);
        throw new TypeError("offline");
      },
    });

    expect(failedRun).toMatchObject({ attempted: 1, failed: 1, recovered: 0 });
    expect(attempted).toEqual([firstId]);
    expect(getMutationOutboxSnapshot("user-a").records).toMatchObject([
      { id: firstId, state: "failed", failure: { kind: "transient" } },
      { id: secondId, state: "pending" },
    ]);

    attempted.length = 0;
    const recoveredRun = await syncMutationOutbox("user-a", {
      run: async (record) => {
        attempted.push(record.id);
      },
    });

    expect(recoveredRun).toMatchObject({
      attempted: 2,
      failed: 0,
      recovered: 2,
    });
    expect(attempted).toEqual([firstId, secondId]);
    expect(getMutationOutboxSnapshot("user-a")).toMatchObject({
      pending: 0,
      failed: 0,
      recovered: 2,
    });
  });

  it("marks invalid records permanent without blocking later valid records", async () => {
    const invalidId = enqueueMutation("user-a", "unknown-kind", {});
    const validId = enqueueMutation("user-a", "set-membership", {
      tmdbId: 3,
      mediaType: "movie",
      inWatchlist: true,
    });

    const result = await syncMutationOutbox("user-a", {
      run: async () => undefined,
    });

    expect(result).toMatchObject({ attempted: 1, failed: 1, recovered: 1 });
    expect(getMutationOutboxSnapshot("user-a").records).toMatchObject([
      { id: invalidId, state: "failed", failure: { kind: "permanent" } },
      { id: validId, state: "recovered" },
    ]);
  });
});
