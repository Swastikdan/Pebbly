import { describe, expect, it } from "vitest";

import {
  makeEpisodeKey,
  parseEpisodeKey,
  resolveNextEpisode,
} from "./watch-progress";

describe("makeEpisodeKey / parseEpisodeKey", () => {
  it("round-trips a tmdbId/season/episode triple", () => {
    const key = makeEpisodeKey(1399, 2, 7);
    expect(key).toBe("1399:2:7");
    expect(parseEpisodeKey(key)).toEqual({
      tmdbId: 1399,
      season: 2,
      episode: 7,
    });
  });

  it("accepts a string tv id like the local store keys do", () => {
    expect(makeEpisodeKey("42", 1, 3)).toBe("42:1:3");
    expect(parseEpisodeKey("42:1:3")).toEqual({
      tmdbId: 42,
      season: 1,
      episode: 3,
    });
  });

  it("returns null for malformed keys instead of NaN parts", () => {
    expect(parseEpisodeKey("not-a-key")).toBeNull();
    expect(parseEpisodeKey("1:2")).toBeNull();
    expect(parseEpisodeKey("1:2:3:4")).toBeNull();
    expect(parseEpisodeKey("a:b:c")).toBeNull();
  });
});

describe("resolveNextEpisode", () => {
  it("resumes at the last played episode when it is not finished", () => {
    expect(
      resolveNextEpisode({
        lastPlayed: { season: 1, episode: 4 },
        isLastPlayedWatched: false,
        watchedEpisodes: [],
      }),
    ).toEqual({ season: 1, episode: 4 });
  });

  it("advances past the last played episode once it is watched", () => {
    expect(
      resolveNextEpisode({
        lastPlayed: { season: 1, episode: 4 },
        isLastPlayedWatched: true,
        watchedEpisodes: [{ season: 1, episode: 4 }],
      }),
    ).toEqual({ season: 1, episode: 5 });
  });

  it("continues after the latest watched episode without a last-played marker", () => {
    expect(
      resolveNextEpisode({
        lastPlayed: null,
        isLastPlayedWatched: false,
        watchedEpisodes: [
          { season: 1, episode: 10 },
          { season: 2, episode: 2 },
          { season: 1, episode: 2 },
        ],
      }),
    ).toEqual({ season: 2, episode: 3 });
  });

  it("starts at S1E1 when nothing has been watched", () => {
    expect(
      resolveNextEpisode({
        lastPlayed: null,
        isLastPlayedWatched: false,
        watchedEpisodes: [],
      }),
    ).toEqual({ season: 1, episode: 1 });
  });

  it("keeps season boundaries when advancing from the final episode of a season", () => {
    expect(
      resolveNextEpisode({
        lastPlayed: { season: 2, episode: 8 },
        isLastPlayedWatched: true,
        watchedEpisodes: [{ season: 2, episode: 8 }],
      }),
    ).toEqual({ season: 2, episode: 9 });
  });
});
