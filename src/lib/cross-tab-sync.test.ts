import { describe, expect, it } from "vitest";

import { isMutationDomain } from "./cross-tab-sync";

describe("cross-tab-sync", () => {
  describe("isMutationDomain", () => {
    it("returns true for valid mutation domains", () => {
      expect(isMutationDomain("watchlist")).toBe(true);
      expect(isMutationDomain("lists")).toBe(true);
      expect(isMutationDomain("ai")).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isMutationDomain("unknown")).toBe(false);
      expect(isMutationDomain("")).toBe(false);
      expect(isMutationDomain(null)).toBe(false);
      expect(isMutationDomain(undefined)).toBe(false);
      expect(isMutationDomain(123)).toBe(false);
      expect(isMutationDomain({})).toBe(false);
      expect(isMutationDomain([])).toBe(false);
      expect(isMutationDomain(true)).toBe(false);
    });
  });
});
