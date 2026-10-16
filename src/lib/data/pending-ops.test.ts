import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PendingOpEntry } from "./pending-ops";
import {
  applyServerState,
  beginOp,
  clearPendingOps,
  reconcileListFetch,
  scheduleSync,
} from "./pending-ops";

/**
 * Interface-level tests for the replayable optimistic journal (ADR-005). They
 * drive the module only through its public seam — `beginOp` + the reconcile /
 * rollback helpers — and assert on observable query-cache outcomes, so they
 * survive internal refactors of the journal.
 */

type Row = { mediaType: "movie" | "tv"; tmdbId: number; title: string };

const KEY = ["watchlist", "list"] as const;

const row = (tmdbId: number, title = `Title ${tmdbId}`): Row => ({
  mediaType: "movie",
  tmdbId,
  title,
});

const setTitle =
  (tmdbId: number, title: string) =>
  (rows: Row[]): Row[] =>
    rows.map((r) => (r.tmdbId === tmdbId ? { ...r, title } : r));

const entry = (
  touchedId: string,
  apply: (rows: Row[]) => Row[],
): PendingOpEntry<Row> => ({
  key: KEY,
  touchedIds: [touchedId],
  apply,
});

function newClient(initial?: Row[]): QueryClient {
  const client = new QueryClient();
  if (initial) client.setQueryData(KEY, initial);
  return client;
}

describe("optimistic journal (pending-ops)", () => {
  beforeEach(() => {
    // `beginOp` is client-only and throws during SSR (window undefined); the
    // journal otherwise needs no DOM. Keep BroadcastChannel undefined so the
    // cross-tab broadcast on resolve is a no-op in node.
    vi.stubGlobal("window", {});
    vi.stubGlobal("BroadcastChannel", undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("applies a pending op immediately and keeps it after resolve", () => {
    const client = newClient([row(1, "orig")]);
    const handle = beginOp<Row>(client, [entry("movie:1", setTitle(1, "opt"))]);

    expect(client.getQueryData<Row[]>(KEY)).toEqual([row(1, "opt")]);

    handle.resolve();
    expect(client.getQueryData<Row[]>(KEY)).toEqual([row(1, "opt")]);
  });

  it("replays still-pending ops on top of a fresh server snapshot", () => {
    const client = newClient([row(1, "orig")]);
    beginOp<Row>(client, [entry("movie:1", setTitle(1, "opt"))]);

    // A snapshot computed before the write committed must not clobber it.
    const merged = reconcileListFetch<Row>(client, KEY, [row(1, "stale")]);

    expect(merged).toEqual([row(1, "opt")]);
  });

  it("stops replaying an op once it resolves (server truth wins)", () => {
    const client = newClient([row(1, "orig")]);
    const handle = beginOp<Row>(client, [entry("movie:1", setTitle(1, "opt"))]);
    handle.resolve();

    const merged = reconcileListFetch<Row>(client, KEY, [row(1, "server")]);

    expect(merged).toEqual([row(1, "server")]);
  });

  it("rolls back only the failed op, leaving other pending ops applied", () => {
    const client = newClient([row(1, "a"), row(2, "b")]);
    const opA = beginOp<Row>(client, [entry("movie:1", setTitle(1, "A"))]);
    beginOp<Row>(client, [entry("movie:2", setTitle(2, "B"))]);

    expect(client.getQueryData<Row[]>(KEY)).toEqual([row(1, "A"), row(2, "B")]);

    opA.remove();

    expect(client.getQueryData<Row[]>(KEY)).toEqual([row(1, "a"), row(2, "B")]);
  });

  it("supersedes an overlapping op with the latest intent", () => {
    const client = newClient([row(1, "orig")]);
    const opA = beginOp<Row>(client, [entry("movie:1", setTitle(1, "A"))]);
    const opB = beginOp<Row>(client, [entry("movie:1", setTitle(1, "B"))]);

    expect(client.getQueryData<Row[]>(KEY)).toEqual([row(1, "B")]);

    // The superseded op is no longer registered: resolving it is a no-op and
    // rolling the winner back must not resurrect the earlier intent.
    opA.resolve();
    expect(client.getQueryData<Row[]>(KEY)).toEqual([row(1, "B")]);

    opB.remove();
    expect(client.getQueryData<Row[]>(KEY)).toEqual([row(1, "orig")]);
  });

  it("applyServerState replaces touched rows and preserves pending ops", () => {
    const client = newClient([row(1, "a"), row(2, "b")]);
    beginOp<Row>(client, [entry("movie:2", setTitle(2, "optB"))]);

    applyServerState(client, KEY, [row(1, "serverA")], ["movie:1"]);

    const data = client.getQueryData<Row[]>(KEY) ?? [];
    expect(data.find((r) => r.tmdbId === 1)?.title).toBe("serverA");
    expect(data.find((r) => r.tmdbId === 2)?.title).toBe("optB");
  });

  it("applyServerState deletes touched rows absent from the server rows", () => {
    const client = newClient([row(1, "a"), row(2, "b")]);

    applyServerState(client, KEY, [], ["movie:2"]);

    expect(client.getQueryData<Row[]>(KEY)).toEqual([row(1, "a")]);
  });

  it("clearPendingOps drops pending ops so later snapshots pass through", () => {
    const client = newClient([row(1, "orig")]);
    beginOp<Row>(client, [entry("movie:1", setTitle(1, "opt"))]);

    clearPendingOps(client);

    const merged = reconcileListFetch<Row>(client, KEY, [row(1, "server")]);
    expect(merged).toEqual([row(1, "server")]);
  });

  it("throws when an op is begun during SSR", () => {
    vi.stubGlobal("window", undefined);
    const client = newClient([row(1, "orig")]);

    expect(() =>
      beginOp<Row>(client, [entry("movie:1", setTitle(1, "opt"))]),
    ).toThrow(/SSR/);
  });

  it("debounces invalidations per key", () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockImplementation(() => Promise.resolve());

    scheduleSync(client, [KEY], 100);
    scheduleSync(client, [KEY], 100);
    vi.advanceTimersByTime(150);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY, exact: false });
  });

  it("invalidates each scheduled key independently", () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockImplementation(() => Promise.resolve());

    scheduleSync(client, [KEY, ["lists", "all"]], 100);
    vi.advanceTimersByTime(150);

    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
