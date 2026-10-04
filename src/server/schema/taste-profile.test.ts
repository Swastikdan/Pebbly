import * as v from "valibot";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TASTE_PROFILE,
  tasteProfileSchema,
  updateTasteProfileArgsSchema,
} from "./taste-profile";

describe("tasteProfileSchema", () => {
  it("matches DEFAULT_TASTE_PROFILE structure", () => {
    const parsed = v.parse(tasteProfileSchema, DEFAULT_TASTE_PROFILE);
    expect(parsed).toEqual(DEFAULT_TASTE_PROFILE);
    expect(parsed.adventureLevel).toBe("balanced");
    expect(parsed.preferredMediaType).toBe("all");
    expect(parsed.preferredGenres).toEqual([]);
    expect(parsed.dislikedGenres).toEqual([]);
    expect(parsed.dislikedThemes).toEqual([]);
    expect(parsed.avoidTitles).toEqual([]);
  });

  it("parses valid custom taste values correctly", () => {
    const input = {
      adventureLevel: "adventurous",
      preferredGenres: ["Sci-Fi", "Cyberpunk"],
      dislikedGenres: ["Horror"],
      dislikedThemes: ["Jump Scares", "Gore"],
      avoidTitles: ["Saw", "Fast & Furious"],
      preferredMediaType: "movie",
    };
    const parsed = v.parse(tasteProfileSchema, input);
    expect(parsed.adventureLevel).toBe("adventurous");
    expect(parsed.preferredGenres).toEqual(["Sci-Fi", "Cyberpunk"]);
    expect(parsed.dislikedGenres).toEqual(["Horror"]);
    expect(parsed.dislikedThemes).toEqual(["Jump Scares", "Gore"]);
    expect(parsed.avoidTitles).toEqual(["Saw", "Fast & Furious"]);
    expect(parsed.preferredMediaType).toBe("movie");
  });

  it("handles empty arrays and nullish items safely", () => {
    const parsed = v.parse(tasteProfileSchema, {
      adventureLevel: "familiar",
      preferredGenres: [],
      dislikedGenres: [],
      dislikedThemes: [],
      avoidTitles: [],
      preferredMediaType: "tv",
    });
    expect(parsed.adventureLevel).toBe("familiar");
    expect(parsed.preferredGenres).toEqual([]);
    expect(parsed.avoidTitles).toEqual([]);
  });
});

describe("updateTasteProfileArgsSchema", () => {
  it("validates update args payload", () => {
    const valid = v.parse(updateTasteProfileArgsSchema, {
      adventureLevel: "adventurous",
      preferredGenres: ["Action"],
      dislikedGenres: ["Romance"],
      dislikedThemes: ["Musical Numbers"],
      avoidTitles: ["Glee"],
      preferredMediaType: "tv",
    });
    expect(valid.adventureLevel).toBe("adventurous");
    expect(valid.dislikedThemes).toEqual(["Musical Numbers"]);
    expect(valid.avoidTitles).toEqual(["Glee"]);
  });

  it("rejects invalid adventure levels", () => {
    expect(() =>
      v.parse(updateTasteProfileArgsSchema, {
        adventureLevel: "extreme" as unknown,
      }),
    ).toThrow();
  });
});
