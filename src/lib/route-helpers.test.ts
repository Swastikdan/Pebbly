import { describe, expect, it } from "vitest";

import {
  collectionRoute,
  mediaDetailRoute,
  tvSeasonRoute,
  tvSeasonsRoute,
} from "./route-helpers";

describe("route-helpers", () => {
  describe("mediaDetailRoute", () => {
    it("builds movie destination with slug and numeric id", () => {
      const dest = mediaDetailRoute({
        mediaType: "movie",
        id: 550,
        slug: "fight-club",
      });

      expect(dest).toEqual({
        to: "/movie/$id/{-$slug}",
        params: { id: "550", slug: "fight-club" },
      });
      expect(dest.search).toBeUndefined();
    });

    it("builds tv destination without slug", () => {
      const dest = mediaDetailRoute({
        mediaType: "tv",
        id: "1399",
      });

      expect(dest).toEqual({
        to: "/tv/$id/{-$slug}",
        params: { id: "1399" },
      });
      expect(dest.search).toBeUndefined();
    });

    it("includes play parameter when play: true", () => {
      const dest = mediaDetailRoute({
        mediaType: "movie",
        id: 123,
        slug: "inception",
        play: true,
      });

      expect(dest).toEqual({
        to: "/movie/$id/{-$slug}",
        params: { id: "123", slug: "inception" },
        search: { play: true },
      });
    });

    it("omits play parameter when play: false", () => {
      const dest = mediaDetailRoute({
        mediaType: "tv",
        id: 456,
        play: false,
      });

      expect(dest).toEqual({
        to: "/tv/$id/{-$slug}",
        params: { id: "456" },
      });
      expect(dest.search).toBeUndefined();
    });
  });

  describe("tvSeasonRoute", () => {
    it("builds tv season destination", () => {
      const dest = tvSeasonRoute({
        id: 1399,
        slug: "game-of-thrones",
        seasonNumber: 1,
      });

      expect(dest).toEqual({
        to: "/tv/$id/{-$slug}/season/$seasonNumber",
        params: {
          id: "1399",
          slug: "game-of-thrones",
          seasonNumber: "1",
        },
      });
    });
  });

  describe("tvSeasonsRoute", () => {
    it("builds tv seasons list destination", () => {
      const dest = tvSeasonsRoute({
        id: "1399",
        slug: "game-of-thrones",
      });

      expect(dest).toEqual({
        to: "/tv/$id/{-$slug}/seasons",
        params: { id: "1399", slug: "game-of-thrones" },
      });
    });
  });

  describe("collectionRoute", () => {
    it("builds collection destination", () => {
      const dest = collectionRoute({
        id: 10,
        slug: "star-wars-collection",
      });

      expect(dest).toEqual({
        to: "/collection/$id/{-$slug}",
        params: { id: "10", slug: "star-wars-collection" },
      });
    });
  });
});
