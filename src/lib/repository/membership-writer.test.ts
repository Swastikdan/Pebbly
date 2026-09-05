import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { enqueueMutation, removeMutation } from "@/lib/data/mutation-outbox";
import { watchlistOptimistic } from "@/lib/data/optimistic/watchlist-optimistic";
import { scheduleSync } from "@/lib/data/pending-ops";
import {
  batchSetWatchlistMembership,
  setWatchlistMembership,
} from "@/server/fns/watchlist";
import { createMembershipWriter } from "./membership-writer";

const item = {
  id: "42",
  media_type: "movie" as const,
  title: "Test Movie",
  image: "poster.jpg",
  rating: 7.5,
  release_date: "2020-01-01",
  overview: "plot",
};

vi.mock("@/server/fns/watchlist", () => ({
  setWatchlistMembership: vi.fn(),
  batchSetWatchlistMembership: vi.fn(),
}));
vi.mock("@/server/schema/common", () => ({
  unwrap: (p: Promise<unknown>) => p,
}));
vi.mock("@/lib/data/optimistic/watchlist-optimistic", () => ({
  watchlistOptimistic: {
    beginMembershipOp: vi.fn(() => ({
      resolve: vi.fn(),
      remove: vi.fn(),
    })),
  },
}));
vi.mock("@/lib/data/pending-ops", () => ({
  applyServerState: vi.fn(),
  scheduleSync: vi.fn(),
}));
vi.mock("@/lib/realtime-mutations", () => ({
  recordOwnMutation: vi.fn(),
}));
vi.mock("@/lib/data/mutation-outbox", () => ({
  enqueueMutation: vi.fn(() => "outbox-1"),
  removeMutation: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({ toast: vi.fn() }));
vi.mock("@/lib/query/keys", () => ({
  queryKeys: {
    watchlist: {
      list: () => ["watchlist", "list"],
      trackedTmdbIds: () => ["watchlist", "tracked"],
    },
  },
}));

describe("createMembershipWriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("coalesces bursts into one batched write, keyed by mediaType:tmdbId", async () => {
    vi.mocked(batchSetWatchlistMembership).mockResolvedValue([
      { mediaType: "movie", tmdbId: 42 },
      { mediaType: "movie", tmdbId: 43 },
    ] as never);

    const writer = createMembershipWriter(undefinedQueryClient(), "user-1");
    void writer.toggleMembership(item, true);
    void writer.toggleMembership({ ...item, id: "43" }, false);

    await vi.advanceTimersByTimeAsync(300);

    expect(batchSetWatchlistMembership).toHaveBeenCalledTimes(1);
    expect(setWatchlistMembership).not.toHaveBeenCalled();
    expect(
      vi.mocked(batchSetWatchlistMembership).mock.calls[0]?.[0].data.items,
    ).toHaveLength(2);
    writer.dispose();
  });

  it("uses the single-item RPC for one membership change", async () => {
    vi.mocked(setWatchlistMembership).mockResolvedValue({
      mediaType: "movie",
      tmdbId: 42,
    } as never);

    const writer = createMembershipWriter(undefinedQueryClient(), "user-1");
    const p = writer.toggleMembership(item, true);
    await vi.advanceTimersByTimeAsync(300);
    await p;

    expect(setWatchlistMembership).toHaveBeenCalledTimes(1);
    expect(batchSetWatchlistMembership).not.toHaveBeenCalled();
    writer.dispose();
  });

  it("resolves optimistic handles and clears outbox entries on success", async () => {
    vi.mocked(setWatchlistMembership).mockResolvedValue({
      mediaType: "movie",
      tmdbId: 42,
    } as never);

    const writer = createMembershipWriter(undefinedQueryClient(), "user-1");
    const p = writer.toggleMembership(item, true);
    await vi.advanceTimersByTimeAsync(300);
    await p;

    const handle = vi.mocked(watchlistOptimistic.beginMembershipOp).mock
      .results[0]?.value as { resolve: ReturnType<typeof vi.fn> };
    expect(handle.resolve).toHaveBeenCalled();
    expect(enqueueMutation).toHaveBeenCalledWith(
      "user-1",
      "set-membership",
      expect.objectContaining({ tmdbId: 42, inWatchlist: true }),
      "movie:42",
    );
    expect(removeMutation).toHaveBeenCalledWith("outbox-1");
    expect(scheduleSync).toHaveBeenCalled();
    writer.dispose();
  });

  it("rolls back optimistic state and rethrows on failure", async () => {
    vi.mocked(setWatchlistMembership).mockRejectedValue(new Error("offline"));

    const writer = createMembershipWriter(undefinedQueryClient(), "user-1");
    const p = writer.toggleMembership(item, true);
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(300);
    await expect(p).rejects.toThrow("offline");

    const handle = vi.mocked(watchlistOptimistic.beginMembershipOp).mock
      .results[0]?.value as { remove: ReturnType<typeof vi.fn> };
    expect(handle.remove).toHaveBeenCalled();
    writer.dispose();
  });
});

function undefinedQueryClient() {
  return {} as Parameters<typeof createMembershipWriter>[0];
}
