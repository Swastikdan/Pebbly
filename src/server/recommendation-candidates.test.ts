import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WatchlistData } from "./prompts";
import { getRecommendationCandidates } from "./recommendation-candidates";

const { getMediaMock, getMovieRecommendationsMock, getTvRecommendationsMock } =
  vi.hoisted(() => ({
    getMediaMock: vi.fn(),
    getMovieRecommendationsMock: vi.fn(),
    getTvRecommendationsMock: vi.fn(),
  }));

vi.mock("@/lib/queries", () => ({
  getMedia: getMediaMock,
  getMovieRecommendations: getMovieRecommendationsMock,
  getTvSeriesRecommendations: getTvRecommendationsMock,
}));

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Popular Movie",
    original_title: "Popular Movie",
    overview: "",
    poster_path: "/poster.jpg",
    release_date: "2024-01-01",
    vote_average: 8,
    vote_count: 1000,
    popularity: 50,
    genre_ids: [18],
    media_type: "movie",
    ...overrides,
  };
}

const watchlistData: WatchlistData = {
  watchItems: [
    {
      tmdbId: 1,
      mediaType: "movie",
      title: "Already Watched",
      rating: 8,
      progressStatus: "done",
      reaction: null,
      progress: 100,
    },
  ],
  lists: [],
  listItems: [],
  inputStats: {
    movieCount: 1,
    tvCount: 0,
    episodesWatched: 0,
    totalItems: 1,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  getMediaMock.mockImplementation(async ({ type }: { type: string }) => {
    if (type === "trending_week") {
      return [
        item({
          id: 3,
          title: "Fresh Trending Movie",
          original_title: "Fresh Trending Movie",
          media_type: "movie",
        }),
        item({
          id: 4,
          name: "Trending Show",
          original_name: "Trending Show",
          title: undefined,
          original_title: undefined,
          first_air_date: "2024-02-01",
          release_date: undefined,
          media_type: "tv",
        }),
      ];
    }
    if (type === "movies_popular") {
      return [
        item(),
        item({
          id: 2,
          title: "Another Movie",
          original_title: "Another Movie",
        }),
      ];
    }
    return [];
  });
  getMovieRecommendationsMock.mockResolvedValue({
    results: [
      item({ id: 5, title: "Seed Match", original_title: "Seed Match" }),
    ],
  });
  getTvRecommendationsMock.mockResolvedValue({ results: [] });
});

describe("getRecommendationCandidates", () => {
  it("uses fresh trending data while excluding watchlist items and wrong media types", async () => {
    const candidates = await getRecommendationCandidates({
      watchItems: watchlistData.watchItems,
      mediaTypePreference: "movie",
      excludeTmdbIds: [],
      excludeTitles: [],
      limit: 20,
    });

    expect(candidates.map((candidate) => candidate.tmdbId)).not.toContain(1);
    expect(candidates.map((candidate) => candidate.tmdbId)).toContain(3);
    expect(
      candidates.every((candidate) => candidate.mediaType === "movie"),
    ).toBe(true);
    expect(getTvRecommendationsMock).not.toHaveBeenCalled();
  });

  it("keeps the AI catalog bounded even when TMDB returns many results", async () => {
    getMediaMock.mockImplementation(async ({ type }: { type: string }) =>
      type === "movies_popular"
        ? Array.from({ length: 50 }, (_, index) =>
            item({
              id: index + 10,
              title: `Movie ${index}`,
              original_title: `Movie ${index}`,
            }),
          )
        : [],
    );

    const candidates = await getRecommendationCandidates({
      watchItems: [],
      mediaTypePreference: "movie",
      excludeTmdbIds: [],
      excludeTitles: [],
      limit: 40,
    });

    expect(candidates).toHaveLength(40);
  });

  it("uses list seeds but limits similarity calls to two titles", async () => {
    await getRecommendationCandidates({
      watchItems: [],
      seedItems: [
        { tmdbId: 101, mediaType: "movie" },
        { tmdbId: 102, mediaType: "movie" },
        { tmdbId: 103, mediaType: "movie" },
      ],
      mediaTypePreference: "movie",
      excludeTmdbIds: [],
      excludeTitles: [],
      limit: 20,
    });

    expect(getMovieRecommendationsMock).toHaveBeenCalledTimes(2);
  });
});
