import { describe, expect, it } from "vitest";

import type { Recommendation } from "./schema/recommendations";
import { balanceHomepageRecommendations } from "./recommendation-pipeline";

function rec(mediaType: "movie" | "tv", index: number): Recommendation {
  return {
    title: `${mediaType} ${index}`,
    tmdbId: index,
    mediaType,
    relevanceScore: 50,
    reasoning: "because",
  };
}

function mix(movieCount: number, tvCount: number): Recommendation[] {
  return [
    ...Array.from({ length: movieCount }, (_, i) => rec("movie", i)),
    ...Array.from({ length: tvCount }, (_, i) => rec("tv", i)),
  ];
}

const mediaTypes = (recommendations: Recommendation[]) =>
  recommendations.map((item) => item.mediaType);

describe("balanceHomepageRecommendations", () => {
  it("caps each media type at 15 and interleaves them", () => {
    const balanced = balanceHomepageRecommendations(mix(20, 20));

    expect(balanced).toHaveLength(30);
    expect(balanced.filter((r) => r.mediaType === "movie")).toHaveLength(15);
    expect(balanced.filter((r) => r.mediaType === "tv")).toHaveLength(15);
    // Strictly alternating movie/tv so neither type is front-loaded.
    expect(mediaTypes(balanced)).toEqual(
      Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? "movie" : "tv")),
    );
  });

  it.each([
    [20, 0],
    [0, 20],
    [16, 1],
    [1, 16],
    [15, 15],
    [14, 14],
    [0, 0],
  ])("terminates for %i movies and %i TV shows", (movieCount, tvCount) => {
    const balanced = balanceHomepageRecommendations(mix(movieCount, tvCount));

    expect(balanced).toHaveLength(
      Math.min(30, Math.min(movieCount, 15) + Math.min(tvCount, 15)),
    );
  });

  it("preserves input order within each media type", () => {
    const balanced = balanceHomepageRecommendations(mix(3, 2));

    expect(
      balanced.filter((r) => r.mediaType === "movie").map((r) => r.title),
    ).toEqual(["movie 0", "movie 1", "movie 2"]);
    expect(
      balanced.filter((r) => r.mediaType === "tv").map((r) => r.title),
    ).toEqual(["tv 0", "tv 1"]);
  });

  it("drops less than 15 TV shows only when there are none", () => {
    const balanced = balanceHomepageRecommendations(mix(15, 0));

    expect(balanced).toHaveLength(15);
    expect(mediaTypes(balanced)).toEqual(Array(15).fill("movie"));
  });
});
