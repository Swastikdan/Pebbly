import { describe, expect, it } from "vitest";

import {
  YOUTUBE_THUMBNAIL_HQ,
  YOUTUBE_THUMBNAIL_LQ,
  YOUTUBE_THUMBNAIL_TIERS,
  youtubeThumbUrl,
} from "./youtube-thumb";

describe("youtubeThumbUrl", () => {
  it("builds the low-quality mqdefault URL", () => {
    expect(youtubeThumbUrl("abc123", "mq")).toBe(
      "https://img.youtube.com/vi/abc123/mqdefault.jpg",
    );
  });

  it("builds the high-quality maxresdefault URL", () => {
    expect(youtubeThumbUrl("abc123", "maxres")).toBe(
      "https://img.youtube.com/vi/abc123/maxresdefault.jpg",
    );
  });

  it("builds every documented tier for the same key", () => {
    const key = "dQw4w9WgXcQ";
    expect(youtubeThumbUrl(key, "default")).toBe(
      `https://img.youtube.com/vi/${key}/default.jpg`,
    );
    expect(youtubeThumbUrl(key, "hq")).toBe(
      `https://img.youtube.com/vi/${key}/hqdefault.jpg`,
    );
  });

  it("defaults to the smallest frame when no tier is given", () => {
    expect(youtubeThumbUrl("abc123")).toBe(
      "https://img.youtube.com/vi/abc123/default.jpg",
    );
  });

  it("handles keys containing dashes and underscores", () => {
    expect(youtubeThumbUrl("abc-def_1", "hq")).toBe(
      "https://img.youtube.com/vi/abc-def_1/hqdefault.jpg",
    );
  });
});

describe("thumbnail tier selection", () => {
  it("uses mq for LQ so the first frame is small and fast", () => {
    expect(YOUTUBE_THUMBNAIL_LQ).toBe("mq");
    expect(YOUTUBE_THUMBNAIL_TIERS[YOUTUBE_THUMBNAIL_LQ]).toBeLessThan(
      YOUTUBE_THUMBNAIL_TIERS[YOUTUBE_THUMBNAIL_HQ],
    );
  });

  it("upgrades to maxres for HQ", () => {
    expect(YOUTUBE_THUMBNAIL_HQ).toBe("maxres");
    expect(
      YOUTUBE_THUMBNAIL_TIERS[YOUTUBE_THUMBNAIL_HQ],
    ).toBeGreaterThanOrEqual(1280);
  });
});
