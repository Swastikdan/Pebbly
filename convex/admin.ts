import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import {
	ADMIN_PERMISSIONS,
	DEFAULT_ROLE_PERMISSIONS,
	PERMISSION_ROLES,
	RBAC_FEATURES,
	RBAC_ROLE_FEATURES,
	type PermissionRole,
	type RbacFeature,
} from "../shared/rbac";

const VALID_FEATURES = Object.keys(RBAC_FEATURES) as RbacFeature[];
const DYNAMIC_ROLES = PERMISSION_ROLES;

export type DynamicRbacRole = PermissionRole;

function isValidRoleFeaturePair(role: string, feature: string): boolean {
	return RBAC_ROLE_FEATURES[role as DynamicRbacRole] === feature;
}

async function getUserByToken(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
) {
  return ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .first();
}

function parseClerkPublicMeta(
  identity: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!identity) return null;

  const candidates = [identity.public_meta, identity.publicMetadata];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate === "string") {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (parsed && typeof parsed === "object") {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Ignore malformed metadata claim payloads.
      }
      continue;
    }

    if (typeof candidate === "object") {
      return candidate as Record<string, unknown>;
    }
  }

  return null;
}

function isClerkAdmin(identity: Record<string, unknown> | null): boolean {
  return parseClerkPublicMeta(identity)?.isAdmin === true;
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");

  const user = await getUserByToken(ctx, identity.subject);
  if (!user) throw new Error("Unauthorized");
  if (!isClerkAdmin(identity)) {
    throw new Error("Forbidden: admin access required");
  }

  return { identity, user };
}

async function computeRoleFeatures(
  ctx: QueryCtx | MutationCtx,
  roles: string[],
): Promise<Record<string, boolean>> {
  const features: Record<string, boolean> = {};

  for (const feature of VALID_FEATURES) {
    let enabled = false;
    for (const role of roles) {
      if (!DYNAMIC_ROLES.includes(role as DynamicRbacRole)) continue;

      const existing = await ctx.db
        .query("role_permissions")
        .withIndex("by_role_feature", (q) =>
          q.eq("role", role).eq("feature", feature),
        )
        .first();

      if (existing) {
        if (existing.enabled) enabled = true;
      } else if (
        DEFAULT_ROLE_PERMISSIONS[role as DynamicRbacRole]?.[feature] === true
      ) {
        enabled = true;
      }
    }
    features[feature] = enabled;
  }

  return features;
}

export async function hasFeature(
  ctx: QueryCtx | MutationCtx,
  feature: RbacFeature,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const user = await getUserByToken(ctx, identity.subject);
  if (!user) return false;

  if (isClerkAdmin(identity)) return true;

  for (const role of user.roles ?? []) {
    if (!DYNAMIC_ROLES.includes(role as DynamicRbacRole)) continue;

    const existing = await ctx.db
      .query("role_permissions")
      .withIndex("by_role_feature", (q) =>
        q.eq("role", role).eq("feature", feature),
      )
      .first();

    if (existing?.enabled === true) return true;
    if (!existing && DEFAULT_ROLE_PERMISSIONS[role as DynamicRbacRole]?.[feature]) {
      return true;
    }
  }

  return false;
}

export async function syncRolePermissions(ctx: MutationCtx) {
	const existingPermissions = await ctx.db.query("role_permissions").collect();

	for (const permission of existingPermissions) {
		const isValidRole = DYNAMIC_ROLES.includes(
      permission.role as DynamicRbacRole,
    );
		const isValidFeature = VALID_FEATURES.includes(
      permission.feature as RbacFeature,
		);

		if (
			!isValidRole ||
			!isValidFeature ||
			!isValidRoleFeaturePair(permission.role, permission.feature)
		) {
			await ctx.db.delete(permission._id);
		}
	}

	for (const role of DYNAMIC_ROLES) {
		const feature = RBAC_ROLE_FEATURES[role];
		const existing = existingPermissions.find(
			(permission) =>
				permission.role === role && permission.feature === feature,
		);

		if (!existing) {
			await ctx.db.insert("role_permissions", {
				role,
				feature,
				enabled: DEFAULT_ROLE_PERMISSIONS[role][feature],
			});
		}
	}
}

export const getUserFeatures = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { roles: [] as string[], features: {}, isAdmin: false };

    const user = await getUserByToken(ctx, identity.subject);
    if (!user) return { roles: [] as string[], features: {}, isAdmin: false };

	if (isClerkAdmin(identity)) {
		return {
			roles: [] as string[],
			features: { ...ADMIN_PERMISSIONS },
			isAdmin: true,
		};
    }

    const roles = (user.roles ?? []).filter((role) =>
      DYNAMIC_ROLES.includes(role as DynamicRbacRole),
    );
    const features = await computeRoleFeatures(ctx, roles);

    return {
      roles,
      features,
      isAdmin: false,
    };
  },
});

export const getRolePermissions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const perms = await ctx.db.query("role_permissions").collect();

		const result: Record<string, Record<string, boolean>> = {};
		for (const role of DYNAMIC_ROLES) {
			result[role] = {};
			const feature = RBAC_ROLE_FEATURES[role];
			const perm = perms.find((p) => p.role === role && p.feature === feature);
			result[role][feature] =
				perm ? perm.enabled : DEFAULT_ROLE_PERMISSIONS[role][feature];
		}

    return result;
  },
});

export const setRolePermission = mutation({
  args: {
    role: v.string(),
    feature: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (!DYNAMIC_ROLES.includes(args.role as DynamicRbacRole)) {
      throw new Error("Invalid role");
    }
    if (!VALID_FEATURES.includes(args.feature as RbacFeature)) {
      throw new Error("Invalid feature");
    }
		if (!isValidRoleFeaturePair(args.role, args.feature)) {
			throw new Error("Invalid role/feature pair");
		}

    await syncRolePermissions(ctx);

    const existing = await ctx.db
      .query("role_permissions")
      .withIndex("by_role_feature", (q) =>
        q.eq("role", args.role).eq("feature", args.feature),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled });
    } else {
      await ctx.db.insert("role_permissions", {
        role: args.role,
        feature: args.feature,
        enabled: args.enabled,
      });
    }
  },
});

export const setUserRoles = mutation({
	args: {
		tokenIdentifier: v.string(),
		roles: v.array(
			v.union(v.literal("video-player"), v.literal("ai-integrations")),
		),
	},
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const target = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();

    if (!target) throw new Error("User not found");

    await ctx.db.patch(target._id, {
      roles: args.roles.length > 0 ? args.roles : undefined,
    });
  },
});

export const migrateLegacyUserRoles = mutation({
	args: { batchSize: v.optional(v.number()) },
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		const users = await ctx.db.query("users").collect();
		let migrated = 0;
		for (const user of users) {
			if (migrated >= (args.batchSize ?? 100)) break;

			const legacyRole = user.role;
			if (!legacyRole || (user.roles?.length ?? 0) > 0) continue;

			await ctx.db.patch(user._id, {
				roles: Array.from(new Set([...(user.roles ?? []), legacyRole])),
				role: undefined,
			});
			migrated += 1;
		}

		return { migrated };
	},
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const caller = await getUserByToken(ctx, identity.subject);
    if (!caller || !isClerkAdmin(identity)) {
      throw new Error("Forbidden: admin access required");
    }

    const users = await ctx.db.query("users").collect();

    return users.map((u) => ({
      _id: u._id,
      tokenIdentifier: u.tokenIdentifier,
      name: u.name ?? "Anonymous",
      email: u.email ?? "No email",
      image: u.image,
      roles: (u.roles ?? []).filter((role) =>
        DYNAMIC_ROLES.includes(role as DynamicRbacRole),
      ),
    }));
  },
});
