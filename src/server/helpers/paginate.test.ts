import { describe, expect, it } from "vitest";

import { collectAllByKeyset } from "./paginate";

describe("collectAllByKeyset", () => {
  it("returns everything across multiple pages", async () => {
    const all = Array.from({ length: 7 }, (_, i) => ({ id: String(i) }));
    const pages: Array<{ id: string }[]> = [
      all.slice(0, 3),
      all.slice(3, 6),
      all.slice(6),
    ];
    let call = 0;
    const cursors: (string | null)[] = [];
    const result = await collectAllByKeyset(3, async (cursor) => {
      cursors.push(cursor);
      return pages[call++] ?? [];
    });
    expect(result).toHaveLength(7);
    expect(cursors).toEqual([null, "2", "5"]);
  });

  it("stops immediately on an empty first page", async () => {
    let calls = 0;
    const result = await collectAllByKeyset(10, async () => {
      calls++;
      return [];
    });
    expect(result).toEqual([]);
    expect(calls).toBe(1);
  });

  it("terminates on a short page without a trailing empty fetch", async () => {
    let calls = 0;
    const result = await collectAllByKeyset(5, async (cursor) => {
      calls++;
      return cursor === null
        ? Array.from({ length: 5 }, (_, i) => ({ id: String(i) }))
        : [{ id: "only" }];
    });
    expect(result.map((r) => r.id)).toEqual(["0", "1", "2", "3", "4", "only"]);
    expect(calls).toBe(2);
  });
});
