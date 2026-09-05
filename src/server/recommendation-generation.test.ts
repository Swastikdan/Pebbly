import { describe, expect, it } from "vitest";

import type { Recommendation } from "./ai";
import { parseStoredRecommendations } from "./recommendation-generation";

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
