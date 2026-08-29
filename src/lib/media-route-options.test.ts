import { describe, expect, it } from "vitest";

import type { RouteComponent } from "@tanstack/react-router";
import {
  castCrewRouteOptions,
  indexRouteOptions,
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
