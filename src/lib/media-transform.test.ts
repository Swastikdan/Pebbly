import { describe, expect, it } from "vitest";

import {
  formatRuntime,
  getPosterImage,
  isInTheatricalWindow,
} from "./media-transform";

describe("isInTheatricalWindow", () => {
  it("returns false for missing or invalid release dates", () => {
    expect(isInTheatricalWindow(null)).toBe(false);
    expect(isInTheatricalWindow(undefined)).toBe(false);
    expect(isInTheatricalWindow("invalid-date")).toBe(false);
  });

  it("returns false for future releases", () => {
    const futureDate = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const releaseDates = [
      { release_dates: [{ type: 3, release_date: futureDate }] },
    ];
    expect(isInTheatricalWindow(futureDate, releaseDates)).toBe(false);
  });

  it("returns false if the release was more than 60 days ago", () => {
    const oldDate = new Date(Date.now() - 65 * 86_400_000).toISOString();
    const releaseDates = [
      { release_dates: [{ type: 3, release_date: oldDate }] },
    ];
    expect(isInTheatricalWindow(oldDate, releaseDates)).toBe(false);
  });

  it("returns false if there was never a theatrical release type", () => {
    const recentDate = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const releaseDates = [
      { release_dates: [{ type: 1, release_date: recentDate }] },
    ];
    expect(isInTheatricalWindow(recentDate, releaseDates)).toBe(false);
  });

  it("returns false if a digital release has already occurred", () => {
    const recentDate = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const digitalDate = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const releaseDates = [
      {
        release_dates: [
          { type: 3, release_date: recentDate },
          { type: 4, release_date: digitalDate },
        ],
      },
    ];
    expect(isInTheatricalWindow(recentDate, releaseDates)).toBe(false);
  });

  it("returns true for recent theatrical release without past digital release", () => {
    const recentDate = new Date(Date.now() - 15 * 86_400_000).toISOString();
    const releaseDates = [
      { release_dates: [{ type: 3, release_date: recentDate }] },
    ];
    expect(isInTheatricalWindow(recentDate, releaseDates)).toBe(true);
  });
});

describe("formatRuntime", () => {
  it("formats minutes into hours and minutes", () => {
    expect(formatRuntime(125)).toBe("2h 5m");
    expect(formatRuntime(60)).toBe("1h 0m");
    expect(formatRuntime(45)).toBe("0h 45m");
  });

  it("returns null for missing runtime", () => {
    expect(formatRuntime(undefined)).toBeNull();
  });
});

describe("getPosterImage", () => {
  it("prepends hd poster prefix when path is given", () => {
    expect(getPosterImage("/poster.jpg")).toContain("/poster.jpg");
  });

  it("returns fallback for missing poster path", () => {
    expect(getPosterImage(null)).toContain("placehold.co");
  });
});
