import { describe, expect, it } from "vitest";

import { tmdbImageUrl, tmdbSrcSet, toTmdbPath } from "./tmdb-image";

describe("tmdbSrcSet", () => {
  it("expands a poster URL into the documented width ladder", () => {
    const srcset = tmdbSrcSet("https://image.tmdb.org/t/p/w500/abc.jpg");
    expect(srcset).toContain("https://image.tmdb.org/t/p/w92/abc.jpg 92w");
    expect(srcset).toContain("https://image.tmdb.org/t/p/w185/abc.jpg 185w");
    expect(srcset).toContain("https://image.tmdb.org/t/p/w342/abc.jpg 342w");
    expect(srcset).toContain("https://image.tmdb.org/t/p/w780/abc.jpg 780w");
    expect(srcset).toContain("https://image.tmdb.org/t/p/w1280/abc.jpg 1280w");
  });

  it("keeps the original URL reachable at its own width", () => {
    const srcset = tmdbSrcSet("https://image.tmdb.org/t/p/w500/abc.jpg");
    expect(srcset).toContain("https://image.tmdb.org/t/p/w500/abc.jpg 500w");
  });

  it("maps h632 profile URLs to an approximate width descriptor", () => {
    const srcset = tmdbSrcSet("https://image.tmdb.org/t/p/h632/face.jpg");
    expect(srcset).toContain("https://image.tmdb.org/t/p/h632/face.jpg 421w");
    expect(srcset).toContain("https://image.tmdb.org/t/p/w185/face.jpg 185w");
  });

  it("returns undefined for non-TMDB sources", () => {
    expect(tmdbSrcSet("data:image/svg+xml;base64,AAAA")).toBeUndefined();
    expect(
      tmdbSrcSet("https://ik.imagekit.io/swastikdan/ogimage.webp"),
    ).toBeUndefined();
    expect(tmdbSrcSet("/logo.svg")).toBeUndefined();
  });

  it("caps original-size URLs at the largest ladder entry", () => {
    const srcset = tmdbSrcSet("https://image.tmdb.org/t/p/original/big.jpg");
    expect(srcset).not.toContain("/original/");
    expect(srcset).toContain("https://image.tmdb.org/t/p/w1280/big.jpg 1280w");
  });

  it("produces parseable candidate entries", () => {
    const srcset = tmdbSrcSet("https://image.tmdb.org/t/p/w342/x.png") ?? "";
    for (const candidate of srcset.split(", ")) {
      const [url, descriptor] = candidate.split(" ");
      expect(url).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
      if (descriptor) {
        expect(descriptor).toMatch(/^\d+w$/);
      }
    }
  });
});

describe("toTmdbPath", () => {
  it("passes a bare path through", () => {
    expect(toTmdbPath("/abc.jpg")).toBe("/abc.jpg");
  });

  it("strips a full TMDB CDN prefix down to the bare path", () => {
    expect(toTmdbPath("https://image.tmdb.org/t/p/w780/abc.jpg")).toBe(
      "/abc.jpg",
    );
  });

  it("returns undefined for empty and non-TMDB values", () => {
    expect(toTmdbPath("")).toBeUndefined();
    expect(toTmdbPath(null)).toBeUndefined();
    expect(toTmdbPath(undefined)).toBeUndefined();
    expect(
      toTmdbPath("https://placehold.co/300x450?text=Image+Not+Found"),
    ).toBeUndefined();
  });
});

describe("tmdbImageUrl", () => {
  it("prefixes a bare path", () => {
    expect(tmdbImageUrl("https://image.tmdb.org/t/p/w185", "/abc.jpg")).toBe(
      "https://image.tmdb.org/t/p/w185/abc.jpg",
    );
  });

  it("does not glue a size prefix in front of a whole URL", () => {
    expect(
      tmdbImageUrl(
        "https://image.tmdb.org/t/p/w185",
        "https://image.tmdb.org/t/p/w780/abc.jpg",
      ),
    ).toBe("https://image.tmdb.org/t/p/w185/abc.jpg");
  });

  it("returns undefined for an absent or non-TMDB value, so the caller can fall back to a placeholder", () => {
    // Guards the 404 cases: a bare prefix, a "null"/"undefined" tail, or a
    // stored external placeholder URL with a size prefix glued on.
    expect(
      tmdbImageUrl("https://image.tmdb.org/t/p/w185", undefined),
    ).toBeUndefined();
    expect(tmdbImageUrl("https://image.tmdb.org/t/p/w185", "")).toBeUndefined();
    expect(
      tmdbImageUrl(
        "https://image.tmdb.org/t/p/w185",
        "https://placehold.co/300x450",
      ),
    ).toBeUndefined();
  });
});
