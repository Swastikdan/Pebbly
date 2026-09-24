import { beforeEach, describe, expect, it } from "vitest";

import type { WatchItemRow } from "@/lib/server-types";
import type { LocalList } from "@/stores/local-lists-store";
import type { WatchlistItem } from "@/stores/watchlist-store";
import {
  buildMigrationPayload,
  clearGuestStores,
  computeMigrationPreview,
} from "@/lib/guest-migration";
import { makeEpisodeKey } from "@/lib/watch-progress";
import { useLocalListsStore } from "@/stores/local-lists-store";
import { useLocalProgressStore } from "@/stores/local-progress-store";
import { useWatchlistStore } from "@/stores/watchlist-store";

describe("guest-migration", () => {
  beforeEach(() => {
    useWatchlistStore.setState({ mediaState: [] });
    useLocalProgressStore.setState({ watchedEpisodes: {}, lastPlayed: {} });
    useLocalListsStore.setState({ lists: [], listItems: [] });
  });

  const createMockItem = (
    id: string,
    type: "movie" | "tv",
    title: string,
  ): WatchlistItem => ({
    external_id: id,
    type,
    title,
    image: "https://image.tmdb.org/t/p/w500/test.jpg",
    rating: 8.5,
    release_date: "2024-01-01",
    overview: "A great movie",
    inWatchlist: true,
    progressStatus: "watching",
    progress: 45,
    reaction: "liked",
    updated_at: 1000,
    created_at: 1000,
  });

  const createMockRow = (
    tmdbId: number,
    mediaType: "movie" | "tv",
  ): WatchItemRow =>
    ({
      id: "row-1",
      userId: "user-1",
      tmdbId,
      mediaType,
      inWatchlist: true,
      progressStatus: "watching",
      progress: 50,
      reaction: null,
      title: "Remote title",
      image: null,
      rating: null,
      releaseDate: null,
      overview: null,
      updatedAt: 2000,
      createdAt: 2000,
    }) as WatchItemRow;

  describe("computeMigrationPreview", () => {
    it("reports all items as new when account has no existing items", () => {
      const media = [
        createMockItem("101", "movie", "Movie 1"),
        createMockItem("102", "tv", "Show 1"),
      ];
      const episodes = {
        [makeEpisodeKey(102, 1, 1)]: true,
        [makeEpisodeKey(102, 1, 2)]: true,
      };
      const lists: LocalList[] = [];

      const preview = computeMigrationPreview(media, episodes, lists, []);

      expect(preview.totalTitles).toBe(2);
      expect(preview.newTitles).toBe(2);
      expect(preview.conflictingTitles).toBe(0);
      expect(preview.watchedEpisodesCount).toBe(2);
      expect(preview.hasData).toBe(true);
    });

    it("correctly identifies conflicting and new titles against account data", () => {
      const media = [
        createMockItem("101", "movie", "Movie 1"),
        createMockItem("102", "tv", "Show 1"),
        createMockItem("103", "movie", "Movie 3"),
      ];
      const remote = [createMockItem("101", "movie", "Remote Movie 1")].map(
        (m) => createMockRow(Number(m.external_id), m.type),
      );

      const preview = computeMigrationPreview(media, {}, [], remote);

      expect(preview.totalTitles).toBe(3);
      expect(preview.newTitles).toBe(2);
      expect(preview.conflictingTitles).toBe(1);
    });

    it("reports hasData false when all stores are empty", () => {
      const preview = computeMigrationPreview([], {}, [], []);
      expect(preview.hasData).toBe(false);
      expect(preview.totalTitles).toBe(0);
    });
  });

  describe("buildMigrationPayload", () => {
    it("transforms local items and watched episodes into server payload format", () => {
      const media = [
        createMockItem("550", "movie", "Fight Club"),
        createMockItem("1399", "tv", "Game of Thrones"),
      ];
      const episodes = {
        [makeEpisodeKey(1399, 1, 1)]: true,
        [makeEpisodeKey(1399, 1, 2)]: true,
        [makeEpisodeKey(1399, 1, 3)]: false, // unwatched, should be omitted
      };

      const payload = buildMigrationPayload(media, episodes);

      expect(payload.items).toHaveLength(2);
      expect(payload.items[0]).toEqual({
        tmdbId: 550,
        mediaType: "movie",
        title: "Fight Club",
        image: "https://image.tmdb.org/t/p/w500/test.jpg",
        rating: 8.5,
        release_date: "2024-01-01",
        overview: "A great movie",
        inWatchlist: true,
        progressStatus: "watching",
        progress: 45,
        reaction: "liked",
      });

      expect(payload.watchedEpisodes).toHaveLength(2);
      expect(payload.watchedEpisodes).toEqual([
        { tmdbId: 1399, season: 1, episode: 1 },
        { tmdbId: 1399, season: 1, episode: 2 },
      ]);
    });
  });

  describe("clearGuestStores", () => {
    it("clears all guest local stores on confirmed success", () => {
      useWatchlistStore.setState({
        mediaState: [createMockItem("550", "movie", "Fight Club")],
      });
      useLocalProgressStore.setState({
        watchedEpisodes: { "1399:1:1": true },
        lastPlayed: { "1399": { season: 1, episode: 1 } },
      });
      useLocalListsStore.setState({
        lists: [
          {
            _id: "list-1",
            name: "Favorites",
            createdAt: 1000,
            updatedAt: 1000,
            sortOrder: 1,
          },
        ],
        listItems: [],
      });

      clearGuestStores();

      expect(useWatchlistStore.getState().mediaState).toHaveLength(0);
      expect(useLocalProgressStore.getState().watchedEpisodes).toEqual({});
      expect(useLocalProgressStore.getState().lastPlayed).toEqual({});
      expect(useLocalListsStore.getState().lists).toHaveLength(0);
    });
  });
});
