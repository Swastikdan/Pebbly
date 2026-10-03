import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { setUserRolesArgsSchema } from "./admin";
import { toggleListItemArgsSchema } from "./lists";
import { generateRecommendationsArgsSchema } from "./recommendations";

describe("input bounds", () => {
  it("rejects an over-long genrePreference (it is interpolated into the LLM prompt)", () => {
    const ok = v.safeParse(generateRecommendationsArgsSchema, {
      genrePreference: "Action, Drama",
    });
    const tooLong = v.safeParse(generateRecommendationsArgsSchema, {
      genrePreference: "x".repeat(301),
    });
    expect(ok.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });

  it("rejects non-integer or non-positive TMDB ids", () => {
    const base = { listId: "l1", mediaType: "movie" } as const;
    expect(
      v.safeParse(toggleListItemArgsSchema, { ...base, tmdbId: 550 }).success,
    ).toBe(true);
    for (const tmdbId of [0, -1, 1.5]) {
      expect(
        v.safeParse(toggleListItemArgsSchema, { ...base, tmdbId }).success,
      ).toBe(false);
    }
    expect(
      v.safeParse(generateRecommendationsArgsSchema, { excludeTmdbIds: [1.5] })
        .success,
    ).toBe(false);
  });

  it("only accepts the remaining assignable roles and bounds the list", () => {
    const tokenIdentifier = "clerk|user_1";
    expect(
      v.safeParse(setUserRolesArgsSchema, {
        tokenIdentifier,
        roles: ["ai-integrations"],
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(setUserRolesArgsSchema, {
        tokenIdentifier,
        roles: ["video-player"],
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(setUserRolesArgsSchema, {
        tokenIdentifier,
        roles: Array(3).fill("ai-integrations"),
      }).success,
    ).toBe(false);
  });
});
