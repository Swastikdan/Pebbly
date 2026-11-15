import { describe, expect, it } from "vitest";

import { buildVidyUrl, resolvePlaybackMode } from "./playback";

describe("playback selection", () => {
  it.each([
    [false, false, null],
    [false, true, "redirect"],
    [true, false, "iframe"],
    [true, true, "iframe"],
  ] as const)(
    "preview=%s external=%s selects %s",
    (preview, external, expected) => {
      expect(
        resolvePlaybackMode(preview, external, "https://player.example"),
      ).toBe(expected);
    },
  );
  it("hides an unconfigured redirect but still allows preview", () => {
    expect(resolvePlaybackMode(false, true)).toBeNull();
    expect(resolvePlaybackMode(true, true)).toBe("iframe");
  });
  it("uses movie IDs and the app accent", () => {
    expect(buildVidyUrl(123, "movie", undefined, undefined, "262626")).toBe(
      "https://www.vidy.st/movie/123?color=262626&autoplay=true",
    );
  });
  it("defaults series to the first episode and enables episode controls", () => {
    const url = new URL(buildVidyUrl(456, "tv"));
    expect(url.pathname).toBe("/tv/456/1/1");
    expect(url.searchParams.get("episodeSelector")).toBe("true");
    expect(url.searchParams.get("nextEpisode")).toBe("true");
    expect(url.searchParams.get("autoplayNextEpisode")).toBe("true");
    expect(new URL(buildVidyUrl(456, "tv", 2, 3)).pathname).toBe("/tv/456/2/3");
  });
});
