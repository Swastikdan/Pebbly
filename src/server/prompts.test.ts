import { describe, expect, it } from "vitest";

import type { WatchlistData } from "./prompts";
import {
  buildCandidateRecommendationPrompt,
  buildGenrePrompt,
  buildHomepageRecommendationsPrompt,
  buildWatchlistPrompt,
} from "./prompts";

function data(): WatchlistData {
  return {
    watchItems: [
      {
        tmdbId: 42,
        mediaType: "movie",
        title: "The Nice Guys",
        rating: 8,
        progressStatus: "done",
        reaction: "loved",
        progress: 100,
      },
      {
        tmdbId: 7,
        mediaType: "tv",
        title: "Fargo",
        rating: null,
        progressStatus: "watching",
        reaction: null,
        progress: 30,
      },
    ],
    lists: [{ _id: "list-1", name: "Comfort watches" }],
    listItems: [
      { listId: "list-1", tmdbId: 99, mediaType: "movie" },
      // Same title also tracked on the watchlist, must not duplicate.
      { listId: "list-1", tmdbId: 42, mediaType: "movie" },
    ],
    inputStats: {
      movieCount: 1,
      tvCount: 1,
      episodesWatched: 12,
      totalItems: 2,
    },
  };
}

describe("buildWatchlistPrompt", () => {
  it("embeds the JSON response contract and the stats block", () => {
    const prompt = buildWatchlistPrompt(data());
    expect(prompt).toContain('"recommendations"');
    expect(prompt).toContain("relevanceScore");
    expect(prompt).toContain("1 movies, 1 TV shows tracked");
  });

  it("lists excluded ids so the model avoids known titles", () => {
    const prompt = buildWatchlistPrompt(data(), undefined, [42, 7]);
    expect(prompt).toContain("42");
    expect(prompt).toContain("7");
  });

  it("respects the requested recommendation count", () => {
    const prompt = buildWatchlistPrompt(
      data(),
      undefined,
      [],
      undefined,
      undefined,
      5,
    );
    expect(prompt).toContain("exactly 5");
  });
});

describe("buildGenrePrompt", () => {
  it("carries the genre preference into the intro", () => {
    const prompt = buildGenrePrompt(data(), "tv", "noir thriller");
    expect(prompt).toContain("noir thriller");
    expect(prompt).toContain("tv");
    expect(prompt).toContain("all selected genres at once");
  });

  it("can treat selected genres as separate lanes", () => {
    const prompt = buildGenrePrompt(
      data(),
      undefined,
      "Comedy, Drama",
      [],
      undefined,
      undefined,
      10,
      "separate",
    );
    expect(prompt).toContain("separate recommendation lanes");
    expect(prompt).toContain("Treat each selected genre independently");
  });
});

describe("buildHomepageRecommendationsPrompt", () => {
  it("includes previous titles to avoid repeats", () => {
    const prompt = buildHomepageRecommendationsPrompt(
      data(),
      ["Title Liked"],
      ["Title Disliked"],
      [123],
      ["Previously Shown"],
    );
    expect(prompt).toContain("Previously Shown");
    expect(prompt).toContain("Title Liked");
    expect(prompt).toContain("Title Disliked");
  });
});

describe("buildCandidateRecommendationPrompt", () => {
  it("includes only the compact current candidate catalog and strict ID rules", () => {
    const prompt = buildCandidateRecommendationPrompt({
      candidates: [
        {
          tmdbId: 550,
          mediaType: "movie",
          title: "Fight Club",
          year: 1999,
          rating: 8.4,
          voteCount: 28000,
        },
      ],
      likedTitles: ["The Nice Guys"],
      dislikedTitles: ["A disliked title"],
      previousTitles: ["Previously Shown"],
      count: 5,
      goal: "Prefer smart crime stories.",
      genrePreference: "Comedy, Drama",
      genreMode: "together",
    });

    expect(prompt).toContain("movie:550");
    expect(prompt).toContain("Fight Club");
    expect(prompt).toContain('"tmdbId": 123');
    expect(prompt).toContain("ONLY select candidates from the catalog");
    expect(prompt).toContain("Never invent a title, TMDB ID, or media type");
    expect(prompt).toContain("smart crime stories");
    expect(prompt).toContain("match all of these genres together");
    expect(prompt).not.toContain("The Nice Guys (TMDB ID:");
  });

  it("embeds adventure styles and disliked themes accurately", () => {
    const promptAdventurous = buildCandidateRecommendationPrompt({
      candidates: [
        {
          tmdbId: 100,
          mediaType: "movie",
          title: "Drive",
          year: 2011,
          rating: 7.9,
          voteCount: 12000,
        },
      ],
      likedTitles: [],
      dislikedTitles: ["Transformers"],
      dislikedThemes: ["Jump Scares", "Gore & Body Horror"],
      adventureLevel: "adventurous",
      previousTitles: [],
      count: 5,
    });

    expect(promptAdventurous).toContain(
      "Strictly avoid these themes: Jump Scares, Gore & Body Horror",
    );
    expect(promptAdventurous).toContain(
      "Adventure style: Adventurous. Prioritize bold storytelling, distinctive hidden gems, and unexpected genre mixes alongside hits.",
    );
    expect(promptAdventurous).toContain(
      "Avoid titles/styles related to: Transformers",
    );

    const promptFamiliar = buildCandidateRecommendationPrompt({
      candidates: [],
      likedTitles: [],
      dislikedTitles: [],
      adventureLevel: "familiar",
      previousTitles: [],
      count: 5,
    });
    expect(promptFamiliar).toContain(
      "Adventure style: Familiar. Prefer established, acclaimed titles closely matching user favorites. Avoid obscure titles.",
    );
  });
});
