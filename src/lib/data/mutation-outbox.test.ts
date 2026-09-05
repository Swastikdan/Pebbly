import * as v from "valibot";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearPendingMutations,
  enqueueMutation,
  mutationOutboxRecordSchema,
  pendingMutationsFor,
  removeMutation,
} from "./mutation-outbox";

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

describe("mutation outbox", () => {
  let storage: StorageMock;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("coalesces the latest intent for one user and item", () => {
    const firstId = enqueueMutation(
      "user-a",
      "set-membership",
      { tmdbId: 1, inWatchlist: true },
      "movie:1",
    );
    const secondId = enqueueMutation(
      "user-a",
      "set-membership",
      { tmdbId: 1, inWatchlist: false },
      "movie:1",
    );

    expect(secondId).not.toBe(firstId);
    expect(pendingMutationsFor("user-a")).toMatchObject([
      {
        id: secondId,
        kind: "set-membership",
        payload: { tmdbId: 1, inWatchlist: false },
        coalesceKey: "movie:1",
      },
    ]);
  });

  it("does not coalesce across users or mutation kinds", () => {
    enqueueMutation("user-a", "set-membership", { value: 1 }, "movie:1");
    enqueueMutation("user-b", "set-membership", { value: 2 }, "movie:1");
    enqueueMutation("user-a", "set-reaction", { value: 3 }, "movie:1");

    expect(pendingMutationsFor("user-a")).toHaveLength(2);
    expect(pendingMutationsFor("user-b")).toHaveLength(1);
  });

  it("filters malformed persisted records and preserves chronological order", () => {
    storage.setItem(
      "pebbly-pending-mutations",
      JSON.stringify([
        { id: "bad", userId: "user-a", kind: "broken" },
        {
          id: "newer",
          userId: "user-a",
          kind: "test",
          payload: 2,
          createdAt: 20,
        },
        {
          id: "older",
          userId: "user-a",
          kind: "test",
          payload: 1,
          createdAt: 10,
        },
      ]),
    );

    expect(pendingMutationsFor("user-a").map((record) => record.id)).toEqual([
      "older",
      "newer",
    ]);
  });

  it("removes one record and can clear only one user", () => {
    const firstId = enqueueMutation("user-a", "test", 1);
    enqueueMutation("user-a", "test", 2);
    enqueueMutation("user-b", "test", 3);

    removeMutation(firstId);
    expect(pendingMutationsFor("user-a")).toHaveLength(1);

    clearPendingMutations("user-a");
    expect(pendingMutationsFor("user-a")).toEqual([]);
    expect(pendingMutationsFor("user-b")).toHaveLength(1);
  });

  it("validates valid record with mutationOutboxRecordSchema", () => {
    const valid = {
      id: "rec-1",
      userId: "user-1",
      kind: "set-watchlist",
      payload: { tmdbId: 10 },
      coalesceKey: "movie:10",
      createdAt: 1000,
    };
    const parsed = v.safeParse(mutationOutboxRecordSchema, valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects non-finite createdAt in mutationOutboxRecordSchema", () => {
    const nanRecord = {
      id: "rec-1",
      userId: "user-1",
      kind: "set-watchlist",
      payload: {},
      createdAt: Number.NaN,
    };
    const infRecord = {
      id: "rec-2",
      userId: "user-1",
      kind: "set-watchlist",
      payload: {},
      createdAt: Number.POSITIVE_INFINITY,
    };

    expect(v.safeParse(mutationOutboxRecordSchema, nanRecord).success).toBe(
      false,
    );
    expect(v.safeParse(mutationOutboxRecordSchema, infRecord).success).toBe(
      false,
    );
  });

  it("rejects records with missing required fields", () => {
    expect(
      v.safeParse(mutationOutboxRecordSchema, {
        id: "rec-1",
        userId: "user-1",
      }).success,
    ).toBe(false);
  });
});
