import { describe, expect, it } from "vitest";

import { isStreamLifetimeAbort } from "./runtime-errors";

describe("isStreamLifetimeAbort", () => {
  it("matches the Workers stream lifetime abort", () => {
    expect(isStreamLifetimeAbort(new Error("Stream lifetime exceeded"))).toBe(
      true,
    );
  });

  it("ignores other errors and non-errors", () => {
    expect(isStreamLifetimeAbort(new Error("D1_ERROR: no such table"))).toBe(
      false,
    );
    expect(isStreamLifetimeAbort("Stream lifetime exceeded")).toBe(false);
    expect(isStreamLifetimeAbort(undefined)).toBe(false);
  });
});
