import { describe, expect, it } from "vitest";

import { collectionViewMode } from "./collection-view";

describe("collectionViewMode", () => {
  it("shows items when the current filter has matches", () => {
    expect(
      collectionViewMode({ mediaFilter: "all", search: "", visibleCount: 3 }),
    ).toBe("items");
  });

  it("reports empty only when the whole collection has no items", () => {
    expect(
      collectionViewMode({ mediaFilter: "all", search: "", visibleCount: 0 }),
    ).toBe("empty");
  });

  it("reports no-matches when a media type exists in the tabs but not the list", () => {
    // TV-only collection, user taps the Movies tab: the collection is not
    // empty, so the tabs and reset action must stay reachable.
    expect(
      collectionViewMode({ mediaFilter: "movie", search: "", visibleCount: 0 }),
    ).toBe("no-matches");
  });

  it("reports no-matches when a search matches nothing", () => {
    expect(
      collectionViewMode({
        mediaFilter: "all",
        search: "zzz",
        visibleCount: 0,
      }),
    ).toBe("no-matches");
  });

  it("ignores searches shorter than the server's minimum query length", () => {
    expect(
      collectionViewMode({ mediaFilter: "all", search: "z", visibleCount: 0 }),
    ).toBe("empty");
    expect(
      collectionViewMode({
        mediaFilter: "all",
        search: " z ",
        visibleCount: 0,
      }),
    ).toBe("empty");
  });

  it("treats a one-character search as inactive even with a media filter", () => {
    expect(
      collectionViewMode({ mediaFilter: "tv", search: "z", visibleCount: 0 }),
    ).toBe("no-matches");
  });
});
