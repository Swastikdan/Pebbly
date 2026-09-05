import { describe, expect, it } from "vitest";

import type { RouteComponent } from "@tanstack/react-router";
import {
  castCrewRouteOptions,
  indexDetailSearch,
  indexRouteOptions,
  mediaGallerySearch,
  mediaRouteOptions,
} from "./media-route-options";

describe("mediaRouteOptions head generators", () => {
  const dummyComponent: RouteComponent = () => null;

  it("formats index route head title without double space before separator", () => {
    const movieOptions = indexRouteOptions("movie", dummyComponent);
    const tvOptions = indexRouteOptions("tv", dummyComponent);

    const movieHead = movieOptions.head({
      loaderData: { id: "123", title: "Inception", posterPath: null },
    });
    const tvHead = tvOptions.head({
      loaderData: { id: "456", title: "Breaking Bad", posterPath: null },
    });

    const movieTitleTag = movieHead.meta.find((m) => "title" in m) as
      { title: string } | undefined;
    const tvTitleTag = tvHead.meta.find((m) => "title" in m) as
      { title: string } | undefined;

    expect(movieTitleTag?.title).toBe("Inception | Pebbly");
    expect(tvTitleTag?.title).toBe("Breaking Bad | Pebbly");
  });

  it("formats media and cast-crew route head titles with suffix", () => {
    const mediaOptions = mediaRouteOptions("movie", dummyComponent);
    const castOptions = castCrewRouteOptions("tv", dummyComponent);

    const mediaHead = mediaOptions.head({
      loaderData: { id: "123", title: "Inception", posterPath: null },
    });
    const castHead = castOptions.head({
      loaderData: { id: "456", title: "Breaking Bad", posterPath: null },
    });

    const mediaTitleTag = mediaHead.meta.find((m) => "title" in m) as
      { title: string } | undefined;
    const castTitleTag = castHead.meta.find((m) => "title" in m) as
      { title: string } | undefined;

    expect(mediaTitleTag?.title).toBe("Inception - Media | Pebbly");
    expect(castTitleTag?.title).toBe("Breaking Bad - Cast & Crew | Pebbly");
  });
});

describe("mediaRouteOptions search validators", () => {
  describe("indexDetailSearch", () => {
    it("parses valid search parameters", () => {
      const result = indexDetailSearch({
        trailer: "abc",
        play: true,
        video: "def",
        backdrop: "gh",
        poster: "ij",
      });

      expect(result).toEqual({
        trailer: "abc",
        play: true,
        video: "def",
        backdrop: "gh",
        poster: "ij",
      });
    });

    it("accepts string 'true' for play", () => {
      expect(indexDetailSearch({ play: "true" })).toEqual({ play: true });
    });

    it("ignores non-string or empty search parameters", () => {
      const result = indexDetailSearch({
        trailer: 123,
        video: ["invalid"],
        backdrop: {},
        poster: "",
        play: "false",
      });

      expect(result).toEqual({});
    });
  });

  describe("mediaGallerySearch", () => {
    it("parses valid gallery search parameters", () => {
      const result = mediaGallerySearch({
        video: "vid1",
        backdrop: "back1",
        poster: "post1",
      });

      expect(result).toEqual({
        video: "vid1",
        backdrop: "back1",
        poster: "post1",
      });
    });

    it("ignores non-string or empty properties", () => {
      const result = mediaGallerySearch({
        video: 42,
        backdrop: null,
        poster: "",
      });

      expect(result).toEqual({});
    });
  });
});
