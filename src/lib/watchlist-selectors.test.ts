import { describe, expect, it } from "vitest";

import {
  findMediaState,
  selectInWatchlist,
  sortRowsByRecent,
} from "./watchlist-selectors";

describe("watchlist selectors", () => {
  const rows = [
    { tmdbId: 1, mediaType: "movie", inWatchlist: true, updated_at: 100 },
    { tmdbId: 2, mediaType: "tv", inWatchlist: false, updated_at: 300 },
    { tmdbId: 3, mediaType: "movie", inWatchlist: true, updated_at: 200 },
  ];

  it("filters to watchlisted rows and sorts most-recent first", () => {
    const result = selectInWatchlist(rows);
    expect(result.map((r) => r.tmdbId)).toEqual([3, 1]);
  });

  it("sorts without mutating the input", () => {
    const input = [rows[0], rows[1]]; // updated_at 100, then 300
    const result = sortRowsByRecent(input);
    expect(result.map((r) => r.tmdbId)).toEqual([2, 1]); // most-recent first
    expect(input.map((r) => r.tmdbId)).toEqual([1, 2]); // input untouched
  });

  it("finds by remote identity (tmdbId + mediaType)", () => {
    const found = findMediaState(rows, "2", "tv");
    expect(found?.tmdbId).toBe(2);
  });

  it("finds by local identity (external_id + type)", () => {
    const local = [
      { external_id: "123", type: "movie", updated_at: 5 },
      { external_id: "456", type: "tv", updated_at: 6 },
    ];
    expect(findMediaState(local, "456", "tv")?.external_id).toBe("456");
    expect(findMediaState(local, "123", "tv")).toBeUndefined();
  });

  it("returns undefined when nothing matches", () => {
    expect(findMediaState(rows, "999", "movie")).toBeUndefined();
  });
});
