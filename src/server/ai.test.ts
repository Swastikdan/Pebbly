import { describe, expect, it } from "vitest";

import type { Recommendation } from "./ai";
import { dedupeRecommendations } from "./ai";

function recommendation(
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    title: "The Matrix",
    tmdbId: 603,
    mediaType: "movie",
    relevanceScore: 80,
    reasoning: "Strong thematic match.",
    ...overrides,
  };
}

describe("dedupeRecommendations", () => {
  it("removes duplicate titles despite punctuation or casing differences", () => {
    const result = dedupeRecommendations([
      recommendation(),
      recommendation({
        title: "the-matrix",
        tmdbId: null,
        relevanceScore: 90,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("the-matrix");
    expect(result[0].relevanceScore).toBe(90);
  });

  it("removes duplicate TMDB identities with different titles", () => {
    const result = dedupeRecommendations([
      recommendation(),
      recommendation({ title: "The Matrix (1999)", relevanceScore: 95 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].relevanceScore).toBe(95);
  });

  it("keeps aliases of a discarded duplicate from reappearing", () => {
    const result = dedupeRecommendations([
      recommendation({ title: "Alias One", tmdbId: 100, relevanceScore: 60 }),
      recommendation({ title: "The Matrix", tmdbId: 603, relevanceScore: 90 }),
      recommendation({ title: "Alias Two", tmdbId: 100, relevanceScore: 70 }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.tmdbId)).toEqual([100, 603]);
  });
});
