import { and, eq } from "drizzle-orm";

import type { AuthUser, ClerkSessionClaims } from "./auth";
import type { Db } from "./db/client";
import { getDb, runBatch } from "./db/client";
import { rolePermissions } from "./db/schema";
import { getEnv } from "./env";

export const DYNAMIC_ROLES = ["video-player", "ai-integrations"] as const;
export const VALID_FEATURES = ["video-player", "ai-recommendations"] as const;

export type DynamicRbacRole = (typeof DYNAMIC_ROLES)[number];
export type RbacFeature = (typeof VALID_FEATURES)[number];

const ADMIN_PERMISSIONS: Record<RbacFeature, true> = {
  "video-player": true,
  "ai-recommendations": true,
};

const DEFAULT_PERMISSIONS: Record<
  DynamicRbacRole,
  Record<RbacFeature, boolean>
> = {
  "video-player": {
    "video-player": true,
    "ai-recommendations": false,
  },
  "ai-integrations": {
    "video-player": false,
    "ai-recommendations": true,
  },
};

export const ROLE_FEATURES: Record<DynamicRbacRole, RbacFeature> = {
  "video-player": "video-player",
  "ai-integrations": "ai-recommendations",
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
    flags[feature] = perm ? perm.enabled : true;
  }
  return flags;
}

/**
 * Extracts public metadata from supported Clerk identity fields.
 *
 * @param identity - The Clerk identity claims to inspect
 * @returns The parsed public metadata, or `null` when no valid metadata is available
 */
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
      globalEnabled !== undefined ? globalEnabled : true;

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

/**
 * Determines whether a user can access a feature.
 *
 * @param claims - Signed session claims used to identify administrators
 * @param user - The authenticated user whose roles and ban status are evaluated
 * @param feature - The feature to check
 * @returns `true` if access is granted, `false` otherwise
 */
export async function hasFeature(
  claims: ClerkSessionClaims | null,
  user: AuthUser | null,
  feature: RbacFeature,
): Promise<boolean> {
  if (!claims) return false;

  if (user?.isBanned === true) return false;
  // Request-path admin decisions come solely from the signed JWT claim —
  // never a live Clerk API call (that would add an external request to every
  // gate check). Admin status reaches the claim via the Clerk session-claims
  // template (`publicMetadata.isAdmin`); see isAdminByClaims.
  //
  // Revocation latency is bounded by token lifetime, not JWT longevity:
  // getSessionClaims verifies the token's `exp` via Clerk's verifyToken and
  // Clerk session tokens are short-lived (reissued continuously), so a
  // demotion in Clerk lands at the next token refresh — never for the life
  // of a long-lived credential. Same contract in getUserFeatures and the
  // authedFn admin gate (fns/rpc.ts).
  if (isAdminByClaims(claims)) {
    return true;
  }
  if (!user) return false;

  const db = getDb(getEnv());
  const roles = (user.roles ?? []).filter((role) =>
    DYNAMIC_ROLES.includes(role as DynamicRbacRole),
  );
  const features = await computeRoleFeatures(db, roles);
  return features[feature] === true;
}

/**
 * Resolves the user's valid dynamic roles, feature access, and account status.
 *
 * @param claims - Verified session claims used to determine administrative access
 * @param user - The authenticated user whose roles and ban status are evaluated
 * @returns The user's roles, enabled features, administrative status, and ban status
 */
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

  // JWT-claim-only admin check, same rationale as hasFeature: staleness of a
  // revoked admin claim is bounded by the verified token's short lifetime.
  if (isAdminByClaims(claims)) {
    return {
      roles: [] as string[],
      features: { ...ADMIN_PERMISSIONS },
      isAdmin: true,
      isBanned: false,
    };
  }
  if (!user) {
    return {
      roles: [] as string[],
      features: {},
      isAdmin: false,
      isBanned: false,
    };
  }

  const db = getDb(getEnv());
  const roles = (user.roles ?? []).filter((role) =>
    DYNAMIC_ROLES.includes(role as DynamicRbacRole),
  );
  const features = await computeRoleFeatures(db, roles);

  return { roles, features, isAdmin: false, isBanned: false };
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

  await runBatch(db, statements);
}
