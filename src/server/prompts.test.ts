import { describe, expect, it } from "vitest";

import type { WatchlistData } from "./prompts";
import {
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
      // Same title also tracked on the watchlist — must not duplicate.
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
