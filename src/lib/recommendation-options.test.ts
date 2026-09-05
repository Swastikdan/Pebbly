import { describe, expect, it } from "vitest";

import type {
  RecommendationHistoryEntry,
  TrackedContentSets,
} from "./recommendation-options";
import type { AIRecommendation } from "@/domain/recommendations";
import {
  buildGenerateMoreOptions,
  buildGenerateOptions,
  filterRenderedRecommendations,
  getDismissKey,
  isTrackedRecommendation,
  selectUntrackedHistory,
} from "./recommendation-options";

const makeRec = (
  overrides: Partial<Parameters<typeof isTrackedRecommendation>[0]>,
) => ({
  mediaType: "movie" as const,
  title: "Some Movie",
  tmdbId: 100,
  relevanceScore: 1,
  reasoning: "because",
  ...overrides,
});

describe("isTrackedRecommendation", () => {
  const tracked: TrackedContentSets = {
    trackedTmdbIds: new Set([100]),
    trackedTitles: new Set(["somemovie"]),
  };

  it("matches by tmdbId", () => {
    expect(isTrackedRecommendation(makeRec({}), tracked)).toBe(true);
  });

  it("matches by normalized title when ids differ", () => {
    expect(
      isTrackedRecommendation(
        makeRec({ tmdbId: 999, verifiedTmdbId: 999 }),
        tracked,
      ),
    ).toBe(true);
  });

  it("returns false for untracked content", () => {
    expect(
      isTrackedRecommendation(
        makeRec({
          tmdbId: 555,
          title: "Other Film",
          verifiedTmdbId: undefined,
        }),
        tracked,
      ),
    ).toBe(false);
  });
});

describe("selectUntrackedHistory", () => {
  const tracked: TrackedContentSets = {
    trackedTmdbIds: new Set([100]),
    trackedTitles: new Set(),
  };
  const entry: RecommendationHistoryEntry = {
    id: "e1",
    recommendations: [makeRec({}) as never, makeRec({ tmdbId: 200 }) as never],
    inputStats: {
      movieCount: 2,
      tvCount: 0,
      episodesWatched: 0,
      totalItems: 2,
    },
    createdAt: 0,
  };

  it("filters tracked recommendations when enabled", () => {
    const result = selectUntrackedHistory([entry], tracked, true);
    expect(result).toHaveLength(1);
    expect(result[0]?.recommendations[0]?.tmdbId).toBe(200);
  });

  it("returns history untouched when filtering is disabled", () => {
    expect(selectUntrackedHistory([entry], tracked, false)).toEqual([entry]);
  });
});

describe("buildGenerateOptions", () => {
  it("caps tracked exclusions and maps era labels to year ranges", () => {
    const tracked = new Set([1, 2, 3]);
    const options = buildGenerateOptions(
      {
        generationType: "genre",
        selectedGenres: ["Action", "Not A Genre"],
        selectedEras: ["80s", "90s"],
        count: 10,
      },
      tracked,
    );
    expect(options.excludeTmdbIds).toEqual([1, 2, 3]);
    expect(options.yearFrom).toBe(1980);
    expect(options.yearTo).toBe(1999);
    expect(options.genreIds).toEqual([28]);
    expect(options.count).toBe(10);
  });

  it("omits exclusions when nothing is tracked", () => {
    const options = buildGenerateOptions(
      { generationType: "watchlist", count: 5 },
      new Set(),
    );
    expect(options.excludeTmdbIds).toBeUndefined();
    expect(options.listId).toBeUndefined();
  });

  it("passes listId only for list generation", () => {
    const options = buildGenerateOptions(
      { generationType: "list", listId: "abc", count: 5 },
      new Set(),
    );
    expect(options.listId).toBe("abc");
  });
});

describe("buildGenerateMoreOptions", () => {
  it("excludes prior recommendations plus tracked ids, deduped", () => {
    const entry: RecommendationHistoryEntry = {
      id: "e1",
      recommendations: [
        makeRec({ tmdbId: 10, verifiedTmdbId: 10 }) as never,
        makeRec({ tmdbId: 20 }) as never,
      ],
      inputStats: {
        movieCount: 2,
        tvCount: 0,
        episodesWatched: 0,
        totalItems: 2,
      },
      createdAt: 0,
    };
    const options = buildGenerateMoreOptions(entry, {
      count: 10,
      trackedTmdbIds: new Set([10, 30]),
    });
    expect(options.excludeTmdbIds).toEqual([10, 20, 30]);
    expect(options.count).toBe(10);
  });
});

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
    const out1 = filterRenderedRecommendations(list, {
      ...empty,
      watchlistKeys: new Set(["movie:1"]),
    });
    expect(out1).toEqual([expect.objectContaining({ tmdbId: 2 })]);
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
