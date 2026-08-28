import { describe, expect, it } from "vitest";

import { guardedMerge } from "./guest-store-kit";

type State = {
  items: string[];
  count: number;
};

describe("guardedMerge", () => {
  const current: State = { items: ["fresh"], count: 0 };

  it("rejects non-object persisted payloads", () => {
    expect(guardedMerge(null, current)).toBe(current);
    expect(guardedMerge(["bad"], current)).toBe(current);
    expect(guardedMerge("bad", current)).toBe(current);
  });

  it("copies only known keys without a sanitizer", () => {
    expect(
      guardedMerge(
        { items: ["saved"], count: 2, injected: "ignored" },
        current,
      ),
    ).toEqual({ items: ["saved"], count: 2 });
  });

  it("keeps only entries accepted by a sanitizer", () => {
    const sanitize = (persisted: unknown): Partial<State> | null => {
      if (!persisted || typeof persisted !== "object") return null;
      const source = persisted as { items?: unknown };
      return {
        items: Array.isArray(source.items)
          ? source.items.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      };
    };

    expect(
      guardedMerge(
        { items: ["saved", 42, "also-saved"], count: "bad" },
        current,
        sanitize,
      ),
    ).toEqual({ items: ["saved", "also-saved"], count: 0 });
  });

  it("falls back to the current state when a sanitizer rejects", () => {
    expect(guardedMerge({ items: [] }, current, () => null)).toBe(current);
  });
});
