import { describe, expect, it } from "vitest";

import type { Recommendation } from "./ai";
import type { RecommendationCandidate } from "./prompts";
import {
  matchRecommendationsToCatalog,
  parseStoredRecommendations,
} from "./recommendation-generation";

describe("parseStoredRecommendations", () => {
  const validRec1: Recommendation = {
    title: "Inception",
    tmdbId: 27205,
    mediaType: "movie",
    relevanceScore: 0.95,
    reasoning: "Great sci-fi thriller",
  };

  const validRec2: Recommendation = {
    title: "Breaking Bad",
    tmdbId: 1396,
    mediaType: "tv",
    relevanceScore: 0.9,
    reasoning: "Compelling drama",
  };

  it("parses valid array of recommendations", () => {
    const result = parseStoredRecommendations([validRec1, validRec2]);
    expect(result).toEqual([validRec1, validRec2]);
  });

  it("parses valid stringified JSON array of recommendations", () => {
    const result = parseStoredRecommendations(
      JSON.stringify([validRec1, validRec2]),
    );
    expect(result).toEqual([validRec1, validRec2]);
  });

  it("filters out invalid entries from mixed array", () => {
    const mixed = [
      validRec1,
      { bad: "entry" },
      { title: 123 }, // invalid title type
      validRec2,
    ];
    const result = parseStoredRecommendations(mixed);
    expect(result).toEqual([validRec1, validRec2]);
  });

  it("returns null for malformed JSON string", () => {
    expect(parseStoredRecommendations("{invalid-json")).toBeNull();
  });

  it("returns null for non-array JSON objects or values", () => {
    expect(
      parseStoredRecommendations(JSON.stringify({ not: "an array" })),
    ).toBeNull();
    expect(parseStoredRecommendations(JSON.stringify(42))).toBeNull();
  });

  it("returns null for falsy values", () => {
    expect(parseStoredRecommendations(null)).toBeNull();
    expect(parseStoredRecommendations(undefined)).toBeNull();
    expect(parseStoredRecommendations("")).toBeNull();
  });

  it("returns empty array for empty input array", () => {
    expect(parseStoredRecommendations([])).toEqual([]);
  });
});

describe("matchRecommendationsToCatalog", () => {
  const catalog: RecommendationCandidate[] = [
    {
      tmdbId: 550,
      mediaType: "movie",
      title: "Fight Club",
      year: 1999,
      rating: 8.4,
      voteCount: 28000,
    },
    {
      tmdbId: 1396,
      mediaType: "tv",
      title: "Breaking Bad",
      year: 2008,
      rating: 8.9,
      voteCount: 12000,
    },
  ];

  const pick = (overrides: Partial<Recommendation> = {}): Recommendation => ({
    title: "Fight Club",
    tmdbId: 550,
    mediaType: "movie",
    relevanceScore: 90,
    reasoning: "because",
    ...overrides,
  });

  it("grounds a pick matching the catalog id", () => {
    const matched = matchRecommendationsToCatalog(
      [pick({ title: "fight club (1999)" })],
      catalog,
    );

    expect(matched).toEqual([
      pick({ title: "Fight Club", tmdbId: 550, mediaType: "movie" }),
    ]);
  });

  it("falls back to the title when the model returns a wrong id", () => {
    const matched = matchRecommendationsToCatalog(
      [pick({ tmdbId: 999999 })],
      catalog,
    );

    expect(matched).toHaveLength(1);
    expect(matched[0]?.tmdbId).toBe(550);
    expect(matched[0]?.title).toBe("Fight Club");
  });

  it("falls back to the title when the model returns no id", () => {
    const matched = matchRecommendationsToCatalog(
      [pick({ tmdbId: null, title: "Breaking Bad", mediaType: "tv" })],
      catalog,
    );

    expect(matched).toHaveLength(1);
    expect(matched[0]?.tmdbId).toBe(1396);
    expect(matched[0]?.mediaType).toBe("tv");
  });

  it("never matches across media types", () => {
    expect(
      matchRecommendationsToCatalog(
        [pick({ tmdbId: null, title: "Breaking Bad", mediaType: "movie" })],
        catalog,
      ),
    ).toEqual([]);
  });

  it("drops invented titles that are not in the catalog", () => {
    expect(
      matchRecommendationsToCatalog(
        [pick({ tmdbId: 1, title: "A Totally Made Up Movie" })],
        catalog,
      ),
    ).toEqual([]);
  });

  it("prefers the best-ranked duplicate title", () => {
    const duplicated: RecommendationCandidate[] = [
      { ...catalog[0], tmdbId: 111 },
      { ...catalog[0], tmdbId: 222 },
    ];
    const matched = matchRecommendationsToCatalog(
      [pick({ tmdbId: null })],
      duplicated,
    );

    expect(matched[0]?.tmdbId).toBe(111);
  });

  it("ignores empty titles instead of matching the first candidate", () => {
    expect(
      matchRecommendationsToCatalog(
        [pick({ tmdbId: null, title: "" })],
        catalog,
      ),
    ).toEqual([]);
  });
});
