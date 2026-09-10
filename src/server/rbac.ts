import { and, eq } from "drizzle-orm";

import type { AuthUser, ClerkSessionClaims } from "./auth";
import type { Db } from "./db/client";
import { getDb, runBatch } from "./db/client";
import { rolePermissions } from "./db/schema";
import { getEnv } from "./env";

export const DYNAMIC_ROLES = [
  "video-player",
  "ai-integrations",
  "external-redirect",
] as const;
export const VALID_FEATURES = [
  "video-player",
  "ai-recommendations",
  "external-redirect",
] as const;

export type DynamicRbacRole = (typeof DYNAMIC_ROLES)[number];
export type RbacFeature = (typeof VALID_FEATURES)[number];

// Default for the `global` kill-switch (the `global:<feature>` row) when the
// row is absent. Gating is uniform for every feature and every user — admins
// included — so a feature is active only when its global flag is enabled AND a
// role granting it is present. These defaults are applied before an admin has
// ever touched a toggle.
const DEFAULT_GLOBAL_PERMISSIONS: Record<RbacFeature, boolean> = {
  "video-player": true,
  "ai-recommendations": true,
  "external-redirect": false,
};

const DEFAULT_PERMISSIONS: Record<
  DynamicRbacRole,
  Record<RbacFeature, boolean>
> = {
  "video-player": {
    "video-player": true,
    "ai-recommendations": false,
    "external-redirect": false,
  },
  "ai-integrations": {
    "video-player": false,
    "ai-recommendations": true,
    "external-redirect": false,
  },
  "external-redirect": {
    "video-player": false,
    "ai-recommendations": false,
    "external-redirect": true,
  },
};

export const ROLE_FEATURES: Record<DynamicRbacRole, RbacFeature> = {
  "video-player": "video-player",
  "ai-integrations": "ai-recommendations",
  "external-redirect": "external-redirect",
};

export async function getGlobalFeatureFlags(
  db: Db,
): Promise<Record<RbacFeature, boolean>> {
  const perms = await db.select().from(rolePermissions);
  const flags = {} as Record<RbacFeature, boolean>;
  for (const feature of VALID_FEATURES) {
    const perm = perms.find(
      (p) => p.role === "global" && p.feature === feature,
    );
    flags[feature] = perm ? perm.enabled : DEFAULT_GLOBAL_PERMISSIONS[feature];
  }
  return flags;
}

function parseClerkPublicMeta(
  identity: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!identity) return null;

  // Claim key varies by session-token template: the default shape is
  // `publicMetadata`/`public_meta`; legacy Convex-era templates embed it as
  // `metadata`. The final candidate handles claims placed at the top level.
  const candidates = [
    identity.public_meta,
    identity.publicMetadata,
    identity.metadata,
    identity,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (parsed && typeof parsed === "object") {
          return parsed as Record<string, unknown>;
        }
      } catch (error) {
        console.warn(
          "[rbac] failed to parse string public_meta:",
          error instanceof Error ? error.message : error,
        );
      }
      continue;
    }
    if (typeof candidate === "object") {
      return candidate as Record<string, unknown>;
    }
  }

  return null;
}

/**
 * True only when the given identity carries an admin `isAdmin` claim inside
 * its public-metadata block (from a signed JWT or a Clerk user resource). There is no DB fallback:
 * a stored `users.is_admin` flag was removed because it went stale, a user
 * demoted in Clerk kept `isAdmin: true` in the DB forever. Access decisions
 * must come from the live JWT/API, never a stored flag.
 */
export function isClerkAdmin(
  identity: Record<string, unknown> | null,
): boolean {
  return parseClerkPublicMeta(identity)?.isAdmin === true;
}

export function isAdminByClaims(claims: ClerkSessionClaims | null): boolean {
  return (
    parseClerkPublicMeta(claims as unknown as Record<string, unknown> | null)
      ?.isAdmin === true
  );
}

async function loadPermissions(db: Db) {
  const rows = await db.select().from(rolePermissions);
  return rows.filter(
    (p) =>
      (p.role === "global" ||
        DYNAMIC_ROLES.includes(p.role as DynamicRbacRole)) &&
      VALID_FEATURES.includes(p.feature as RbacFeature),
  );
}

async function computeRoleFeatures(
  db: Db,
  roles: string[],
): Promise<Record<string, boolean>> {
  const features: Record<string, boolean> = {};
  const allPermissions = await loadPermissions(db);

  const permissionMap = new Map<string, boolean>();
  for (const p of allPermissions) {
    permissionMap.set(`${p.role}:${p.feature}`, p.enabled);
  }

  for (const feature of VALID_FEATURES) {
    const globalEnabled = permissionMap.get(`global:${feature}`);
    const isGloballyEnabled =
      globalEnabled !== undefined
        ? globalEnabled
        : DEFAULT_GLOBAL_PERMISSIONS[feature];

    let enabled = false;
    if (isGloballyEnabled) {
      for (const role of roles) {
        if (!DYNAMIC_ROLES.includes(role as DynamicRbacRole)) continue;
        const existingEnabled = permissionMap.get(`${role}:${feature}`);
        if (existingEnabled !== undefined) {
          if (existingEnabled) enabled = true;
        } else if (
          DEFAULT_PERMISSIONS[role as DynamicRbacRole]?.[feature] === true
        ) {
          enabled = true;
        }
      }
    }
    features[feature] = enabled;
  }

  return features;
}

export async function hasFeature(
  claims: ClerkSessionClaims | null,
  user: AuthUser | null,
  feature: RbacFeature,
): Promise<boolean> {
  if (!claims) return false;
  if (user?.isBanned === true) return false;
  if (!user) return false;

  // Uniform gating for every feature, administrators included: the `global`
  // flag for the feature must be enabled AND the user must hold a role that
  // grants it. There is no admin bypass — admin status grants access to the
  // admin surface (see the `admin: true` gate in authedFn), not automatic
  // consumer features. The same contract is used by getUserFeatures.
  const db = getDb(getEnv());
  const roles = (user.roles ?? []).filter((role) =>
    DYNAMIC_ROLES.includes(role as DynamicRbacRole),
  );
  const features = await computeRoleFeatures(db, roles);
  return features[feature] === true;
}

export async function getUserFeatures(
  claims: ClerkSessionClaims | null,
  user: AuthUser | null,
) {
  if (!claims) {
    return {
      roles: [] as string[],
      features: {},
      isAdmin: false,
      isBanned: false,
    };
  }

  if (user?.isBanned === true) {
    return {
      roles: [] as string[],
      features: {},
      isAdmin: false,
      isBanned: true,
    };
  }

  const isAdmin = isAdminByClaims(claims);
  const db = getDb(getEnv());
  const roles = (user?.roles ?? []).filter((role) =>
    DYNAMIC_ROLES.includes(role as DynamicRbacRole),
  );

  if (!user) {
    return {
      roles: [] as string[],
      features: {},
      isAdmin,
      isBanned: false,
    };
  }

  // Uniform for everyone (admins included): features are derived purely from
  // granted roles gated by the global flags — no admin auto-enable. Admins must
  // turn the flag on and hold the relevant role to use a feature.
  const features = await computeRoleFeatures(db, roles);

  return { roles, features, isAdmin, isBanned: false };
}

/**
 * `syncRolePermissions` port, prunes invalid rows and seeds defaults.
 */
export async function syncRolePermissions(
  db: Db,
  force = false,
): Promise<void> {
  const existingPermissions = await loadPermissions(db);

  if (!force && existingPermissions.length > 0) {
    return;
  }

  const statements: unknown[] = [];
  const deleteKeys = new Set<string>();

  for (const permission of existingPermissions) {
    const isValidRole =
      DYNAMIC_ROLES.includes(permission.role as DynamicRbacRole) ||
      permission.role === "global";
    const isValidFeature = VALID_FEATURES.includes(
      permission.feature as RbacFeature,
    );
    if (
      !isValidRole ||
      !isValidFeature ||
      (permission.role !== "global" &&
        ROLE_FEATURES[permission.role as DynamicRbacRole] !==
          permission.feature)
    ) {
      const key = `${permission.role}:${permission.feature}`;
      if (!deleteKeys.has(key)) {
        deleteKeys.add(key);
        statements.push(
          db
            .delete(rolePermissions)
            .where(
              and(
                eq(rolePermissions.role, permission.role),
                eq(rolePermissions.feature, permission.feature),
              ),
            ),
        );
      }
    }
  }

  for (const role of DYNAMIC_ROLES) {
    const feature = ROLE_FEATURES[role];
    const existing = existingPermissions.some(
      (permission) =>
        permission.role === role && permission.feature === feature,
    );
    if (!existing) {
      statements.push(
        db
          .insert(rolePermissions)
          .values({
            role,
            feature,
            enabled: DEFAULT_PERMISSIONS[role][feature],
          })
          .onConflictDoNothing(),
      );
    }
  }

  // Seed the `global` kill-switch rows so the DB matches the read-time
  // defaults (External Player Redirect is OFF until an admin turns it on).
  for (const feature of VALID_FEATURES) {
    const existing = existingPermissions.some(
      (permission) =>
        permission.role === "global" && permission.feature === feature,
    );
    if (!existing) {
      statements.push(
        db
          .insert(rolePermissions)
          .values({
            role: "global",
            feature,
            enabled: DEFAULT_GLOBAL_PERMISSIONS[feature],
          })
          .onConflictDoNothing(),
      );
    }
  }

  await runBatch(db, statements);
}
