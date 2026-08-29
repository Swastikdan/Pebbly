import { describe, expect, it } from "vitest";

import type { AIRecommendation } from "@/domain/recommendations";
import {
  filterRenderedRecommendations,
  getDismissKey,
} from "./recommendation-options";

const rec = (overrides: Partial<AIRecommendation> = {}): AIRecommendation => ({
  mediaType: "movie",
  tmdbId: 1,
  title: "Test",
  relevanceScore: 0.5,
  reasoning: "because",
  ...overrides,
});

const empty = {
  dismissedKeys: new Set<string>(),
  dislikedKeys: new Set<string>(),
  watchlistKeys: new Set<string>(),
  likedKeys: new Set<string>(),
};

describe("getDismissKey", () => {
  it("includes mediaType, tmdbId and title", () => {
    expect(getDismissKey(rec())).toBe("movie:1:Test");
  });

  it("falls back to empty id when tmdbId is null", () => {
    expect(getDismissKey(rec({ tmdbId: null, title: "T" }))).toBe("movie::T");
  });
});

describe("filterRenderedRecommendations", () => {
  it("returns an empty array when there are no recommendations", () => {
    expect(filterRenderedRecommendations(undefined, empty)).toEqual([]);
  });

  it("passes through recommendations unchanged when no filters apply", () => {
    const list = [rec({ tmdbId: 1 }), rec({ tmdbId: 2, title: "Two" })];
    expect(filterRenderedRecommendations(list, empty)).toHaveLength(2);
  });

  it("drops locally dismissed rows", () => {
    const list = [rec({ tmdbId: 1 }), rec({ tmdbId: 2 })];
    expect(
      filterRenderedRecommendations(list, {
        ...empty,
        dismissedKeys: new Set(["movie:1:Test"]),
      }),
    ).toHaveLength(1);
  });

  it("drops disliked rows and keeps the rest", () => {
    const list = [rec({ tmdbId: 1 }), rec({ tmdbId: 2 })];
    expect(
      filterRenderedRecommendations(list, {
        ...empty,
        dislikedKeys: new Set(["movie:2"]),
      }),
    ).toEqual([expect.objectContaining({ tmdbId: 1 })]);
  });

  it("drops watchlist rows unless explicitly liked", () => {
    const list = [rec({ tmdbId: 1 }), rec({ tmdbId: 2 })];
    // Member but not liked → removed.
    const out1 = filterRenderedRecommendations(list, {
      ...empty,
      watchlistKeys: new Set(["movie:1"]),
    });
    expect(out1).toEqual([expect.objectContaining({ tmdbId: 2 })]);
    // Member AND liked in this session → kept.
    const out2 = filterRenderedRecommendations(list, {
      ...empty,
      watchlistKeys: new Set(["movie:1"]),
      likedKeys: new Set(["movie:1"]),
    });
    expect(out2).toHaveLength(2);
  });

  it("leaves rows without a tmdbId alone (only the dismiss key applies)", () => {
    const list = [rec({ tmdbId: null, title: "Unknown" })];
    expect(filterRenderedRecommendations(list, empty)).toHaveLength(1);
  });
});
