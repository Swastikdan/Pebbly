import { afterEach, describe, expect, it, vi } from "vitest";

import type { Recommendation } from "./ai";
import { dedupeRecommendations, generateRecommendations } from "./ai";

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

describe("generateRecommendations", () => {
  const validResponse = {
    response: JSON.stringify({ recommendations: [recommendation()] }),
  };
  const truncatedResponse = {
    response: '{"recommendations":[{"title":"The Matrix","tmdbId":6',
  };

  function stubAi(...responses: unknown[]) {
    const run = vi.fn();
    for (const response of responses) run.mockResolvedValueOnce(response);
    vi.stubGlobal("__env__", { AI: { run } });
    return run;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries a malformed response within the retry budget", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const run = stubAi(truncatedResponse, validResponse);

    const result = await generateRecommendations({
      prompt: "prompt",
      systemInstruction: "system",
      retries: 2,
    });

    expect(run).toHaveBeenCalledTimes(2);
    expect(result.error).toBeUndefined();
    expect(result.result?.recommendations).toHaveLength(1);
  });

  it("reports invalid_response when every attempt is malformed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const run = stubAi(truncatedResponse, truncatedResponse);

    const result = await generateRecommendations({
      prompt: "prompt",
      systemInstruction: "system",
      retries: 2,
    });

    expect(run).toHaveBeenCalledTimes(2);
    expect(result.error).toBe("invalid_response");
  });
});
