import { describe, expect, it } from "vitest";

import type { AuthUser } from "../auth";
import { pickCanonicalMatch } from "./user-merge";

function user(id: string, tokenIdentifier: string): AuthUser {
  return {
    id,
    tokenIdentifier,
    name: null,
    image: null,
    email: null,
    roles: [],
    isBanned: false,
    watchlistRev: 0,
    listsRev: 0,
    aiRev: 0,
    permsRev: 0,
  };
}

describe("pickCanonicalMatch", () => {
  it("returns null with no matches", () => {
    expect(pickCanonicalMatch([], "clerk|sub")).toBeNull();
  });

  it("returns the single match", () => {
    const u = user("a", "clerk|sub");
    expect(pickCanonicalMatch([u], "clerk|sub")).toBe(u);
  });

  it("prefers the canonical clerk|<sub> row", () => {
    const legacy = user("b", "old-legacy|sub");
    const canonical = user("a", "clerk|sub");
    expect(pickCanonicalMatch([legacy, canonical], "clerk|sub")).toBe(
      canonical,
    );
  });

  it("falls back to the legacy bare-subject format before id ordering", () => {
    const piped = user("a1", "other|sub");
    const bare = user("z9", "sub");
    expect(pickCanonicalMatch([piped, bare], "clerk|sub")).toBe(bare);
  });

  it("breaks ties with deterministic lowest id when formats are all legacy-piped", () => {
    const late = user("z9", "aaa|sub");
    const early = user("a1", "bbb|sub");
    expect(pickCanonicalMatch([late, early], "clerk|sub")).toBe(early);
  });
});
