import { describe, expect, it } from "vitest";

import { hashString, normalizeTitleKey } from "./text";

describe("normalizeTitleKey", () => {
  it("lowercases and strips non-alphanumerics", () => {
    expect(normalizeTitleKey("Spider-Man: No Way Home!")).toBe(
      "spidermannowayhome",
    );
  });

  it("treats missing titles as the empty key", () => {
    expect(normalizeTitleKey(null)).toBe("");
    expect(normalizeTitleKey(undefined)).toBe("");
    expect(normalizeTitleKey("")).toBe("");
  });

  it("collapses punctuation/case-only differences to the same key", () => {
    expect(normalizeTitleKey("Spider-Man")).toBe(
      normalizeTitleKey("spider man"),
    );
  });
});

describe("hashString", () => {
  it("is deterministic", () => {
    expect(hashString("abc|mt:movie|g:action")).toBe(
      hashString("abc|mt:movie|g:action"),
    );
  });

  it("distinguishes different inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("returns a 32-bit integer", () => {
    const h = hashString("anything");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeLessThanOrEqual(2_147_483_647);
    expect(h).toBeGreaterThanOrEqual(-2_147_483_648);
  });
});
