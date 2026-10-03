import { describe, expect, it, vi } from "vitest";

import type { Db } from "./db/client";
import {
  DYNAMIC_ROLES,
  isAdminByClaims,
  ROLE_FEATURES,
  syncRolePermissions,
  VALID_FEATURES,
} from "./rbac";

describe("RBAC constants and role mappings", () => {
  it("does not include video-player in dynamic roles or valid features", () => {
    expect(DYNAMIC_ROLES).not.toContain("video-player");
    expect(VALID_FEATURES).not.toContain("video-player");
    expect(Object.keys(ROLE_FEATURES)).not.toContain("video-player");
    expect(Object.values(ROLE_FEATURES)).not.toContain("video-player");
  });

  it("maps dynamic roles 1:1 to valid features", () => {
    expect(DYNAMIC_ROLES).toEqual(["ai-integrations", "external-redirect"]);
    expect(VALID_FEATURES).toEqual(["ai-recommendations", "external-redirect"]);
    expect(ROLE_FEATURES["ai-integrations"]).toBe("ai-recommendations");
    expect(ROLE_FEATURES["external-redirect"]).toBe("external-redirect");
  });
});

describe("isAdminByClaims", () => {
  it("returns false for null claims", () => {
    expect(isAdminByClaims(null)).toBe(false);
  });

  it("returns true when publicMetadata.isAdmin is true", () => {
    expect(
      isAdminByClaims({ sub: "u1", publicMetadata: { isAdmin: true } }),
    ).toBe(true);
  });

  it("returns true when public_meta.isAdmin is true", () => {
    expect(isAdminByClaims({ sub: "u1", public_meta: { isAdmin: true } })).toBe(
      true,
    );
  });

  it("returns false when isAdmin is false or missing", () => {
    expect(
      isAdminByClaims({ sub: "u1", publicMetadata: { isAdmin: false } }),
    ).toBe(false);
    expect(isAdminByClaims({ sub: "u1", publicMetadata: {} })).toBe(false);
  });
});

describe("syncRolePermissions", () => {
  it("prunes invalid video-player rows and seeds missing valid features", async () => {
    const executedStatements: Array<{ type: string }> = [];
    const mockDb = {
      select: () => ({
        from: () =>
          Promise.resolve([
            // Stale rows that should be pruned
            { role: "video-player", feature: "video-player", enabled: true },
            { role: "global", feature: "video-player", enabled: true },
            // Valid existing row
            {
              role: "ai-integrations",
              feature: "ai-recommendations",
              enabled: true,
            },
          ]),
      }),
      delete: () => ({
        where: (expr: unknown) => ({ type: "delete", expr }),
      }),
      insert: () => ({
        values: (val: unknown) => ({
          onConflictDoNothing: () => ({ type: "insert", val }),
        }),
      }),
      batch: vi.fn(async (stmts: unknown[]) => {
        executedStatements.push(...(stmts as Array<{ type: string }>));
      }),
    } as unknown as Db;

    await syncRolePermissions(mockDb, true);

    expect(mockDb.batch).toHaveBeenCalled();
    const deletes = executedStatements.filter((s) => s.type === "delete");
    // Should have generated delete statements for the 2 invalid video-player rows
    expect(deletes.length).toBe(2);

    const inserts = executedStatements.filter((s) => s.type === "insert");
    // Should seed missing dynamic role (external-redirect) and missing globals
    expect(inserts.length).toBeGreaterThanOrEqual(2);
  });
});
