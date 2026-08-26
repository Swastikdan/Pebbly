import { describe, expect, it } from "vitest";

import type { WatchItemRow } from "./watch-item";
import {
  buildMetadataPatch,
  normalizeProgressStatus,
  normalizeReaction,
  planMembershipRemoval,
} from "./watch-item";

function row(overrides: Partial<WatchItemRow> = {}): WatchItemRow {
  return {
    id: "row-1",
    userId: "user-1",
    tmdbId: 42,
    mediaType: "movie",
    inWatchlist: true,
    progressStatus: "watching",
    progress: 40,
    reaction: null,
    title: null,
    image: null,
    rating: null,
    releaseDate: null,
    overview: null,
    updatedAt: 1,
    ...overrides,
  };
}

describe("normalizeProgressStatus", () => {
  it("passes valid statuses through", () => {
    expect(normalizeProgressStatus("watching")).toBe("watching");
    expect(normalizeProgressStatus("done")).toBe("done");
  });

  it("maps invalid or missing values to undefined", () => {
    expect(normalizeProgressStatus("bogus")).toBeUndefined();
    expect(normalizeProgressStatus("")).toBeUndefined();
    expect(normalizeProgressStatus(null)).toBeUndefined();
    expect(normalizeProgressStatus(undefined)).toBeUndefined();
  });
});

describe("normalizeReaction", () => {
  it("passes valid reactions through", () => {
    expect(normalizeReaction("loved")).toBe("loved");
  });

  it("maps invalid, empty, and missing values to null", () => {
    expect(normalizeReaction("meh")).toBeNull();
    expect(normalizeReaction("   ")).toBeNull();
    expect(normalizeReaction(null)).toBeNull();
    expect(normalizeReaction(undefined)).toBeNull();
  });
});

describe("buildMetadataPatch", () => {
  it("clamps rating into the watch_items CHECK range (0..10)", () => {
    expect(buildMetadataPatch({ rating: 99 }).rating).toBe(10);
    expect(buildMetadataPatch({ rating: -3 }).rating).toBe(0);
    expect(buildMetadataPatch({ rating: 7.5 }).rating).toBe(7.5);
  });

  it("falls back to NaN-safe existing rating", () => {
    const existing = row({ rating: 5 });
    expect(buildMetadataPatch({ rating: Number.NaN }, existing).rating).toBe(5);
    expect(buildMetadataPatch({ rating: Number.NaN }).rating).toBeUndefined();
  });

  it("prefers incoming metadata, falling back to the existing row", () => {
    const existing = row({
      title: "Old",
      image: "old.png",
      releaseDate: "2001-01-01",
    });
    const patch = buildMetadataPatch(
      { title: "New", release_date: "2024-05-06" },
      existing,
    );
    expect(patch.title).toBe("New");
    expect(patch.releaseDate).toBe("2024-05-06");
    expect(patch.image).toBe("old.png");
  });

  it("maps snake_case metadata fields onto DB columns", () => {
    expect(buildMetadataPatch({ release_date: "2020-02-02" }).releaseDate).toBe(
      "2020-02-02",
    );
  });
});

describe("planMembershipRemoval", () => {
  it("deletes rows with no attachment", () => {
    const plan = planMembershipRemoval(row({ reaction: null, progress: 0 }), 0);
    expect(plan).toEqual({ delete: true });
  });

  it("keeps rows with a reaction", () => {
    const plan = planMembershipRemoval(
      row({ reaction: "loved", progress: 0 }),
      100,
    );
    if (plan.delete) throw new Error("expected keep");
    expect(plan.nextRow.inWatchlist).toBe(false);
    expect(plan.nextRow.reaction).toBe("loved");
    expect(plan.nextRow.updatedAt).toBe(100);
  });

  it("keeps rows with real watching progress", () => {
    const plan = planMembershipRemoval(
      row({ progress: 55, progressStatus: "watching" }),
      0,
    );
    expect(plan.delete).toBe(false);
  });

  it("treats watch-later-only progress as no attachment", () => {
    const plan = planMembershipRemoval(
      row({ progress: 30, progressStatus: "watch-later" }),
      0,
    );
    expect(plan.delete).toBe(true);
  });

  it("clears a watch-later status on kept rows", () => {
    const plan = planMembershipRemoval(
      row({ reaction: "liked", progressStatus: "watch-later" }),
      0,
    );
    if (plan.delete) throw new Error("expected keep");
    expect(plan.nextRow.progressStatus).toBeNull();
  });
});
