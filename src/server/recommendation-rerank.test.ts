import { describe, expect, it, vi } from "vitest";

import type { RecommendationCandidate } from "./prompts";
import {
  rankCandidates,
  rerankCandidatesWithJev,
} from "./recommendation-rerank";

const candidates: RecommendationCandidate[] = [
  {
    tmdbId: 1,
    mediaType: "movie",
    title: "Heuristic winner",
    year: 2020,
    rating: 8,
    voteCount: 1000,
    genreIds: [35],
  },
  {
    tmdbId: 2,
    mediaType: "movie",
    title: "Jev winner",
    year: 2021,
    rating: 7.5,
    voteCount: 900,
    genreIds: [35, 18],
  },
];

describe("rerankCandidatesWithJev", () => {
  it("returns candidates unchanged when no Workers AI binding exists", async () => {
    const result = await rerankCandidatesWithJev(candidates, {
      enabled: true,
      likedTitles: ["A reference title"],
    });

    expect(result.candidates).toBe(candidates);
    expect(result.ran).toBe(false);
    expect(result.fallbackReason).toBe("no_binding");
  });

  it("blends confident Jev scores into the existing candidate order", async () => {
    const run = vi.fn().mockResolvedValue({
      answers: {
        genre_fit: { score: 3, confidence: 0.92 },
        taste_fit: { noul: 0.95 },
      },
    });
    const result = await rerankCandidatesWithJev(candidates, {
      enabled: true,
      ai: { run },
      selectedGenres: ["Comedy", "Drama"],
      likedTitles: ["A reference title"],
    });

    expect(result.ran).toBe(true);
    expect(result.scored).toBe(2);
    expect(result.meanConfidence).toBeCloseTo(0.92);
    expect(result.candidates).toHaveLength(2);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps the heuristic order for scores below the confidence floor", () => {
    const ranked = rankCandidates(candidates, [
      { score: 0, confidence: 0.2 },
      { score: 1, confidence: 0.2 },
    ]);

    expect(ranked).toEqual(candidates);
  });

  it("keeps valid scores when one provider call fails", async () => {
    let calls = 0;
    const result = await rerankCandidatesWithJev(candidates, {
      enabled: true,
      ai: {
        run: vi.fn().mockImplementation(async () => {
          calls += 1;
          if (calls === 1) throw new Error("timeout");
          return { answers: { taste_fit: { noul: 1 } } };
        }),
      },
      likedTitles: ["A reference title"],
    });

    expect(result.ran).toBe(true);
    expect(result.scored).toBe(1);
    expect(result.failed).toBe(1);
  });
});
