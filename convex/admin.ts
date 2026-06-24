import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";

const DYNAMIC_ROLES = ["video-player", "ai-integrations"] as const;
const VALID_FEATURES = ["video-player", "ai-recommendations"] as const;

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

const ROLE_FEATURES: Record<DynamicRbacRole, RbacFeature> = {
	"video-player": "video-player",
	"ai-integrations": "ai-recommendations",
};

function isValidRoleFeaturePair(role: string, feature: string): boolean {
	return ROLE_FEATURES[role as DynamicRbacRole] === feature;
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

  const candidates = [identity.public_meta, identity.publicMetadata, identity];

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

function isClerkAdmin(
  identity: Record<string, unknown> | null,
  dbUser?: { isAdmin?: boolean } | null,
): boolean {
  if (parseClerkPublicMeta(identity)?.isAdmin === true) return true;
  if (dbUser?.isAdmin === true) return true;
  return false;
}

async function requireAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");

  const user = await getUserByToken(ctx, identity.subject);
  if (!user) throw new Error("Unauthorized");
  if (!isClerkAdmin(identity, user)) {
    throw new Error("Forbidden: admin access required");
  }

  return { identity, user };
}

async function computeRoleFeatures(
  ctx: QueryCtx | MutationCtx,
  roles: string[],
): Promise<Record<string, boolean>> {
  const features: Record<string, boolean> = {};

  const allPermissions = await ctx.db
    .query("role_permissions")
    .collect();

  const permissionMap = new Map<string, boolean>();
  for (const p of allPermissions) {
    permissionMap.set(`${p.role}:${p.feature}`, p.enabled);
  }

  for (const feature of VALID_FEATURES) {
    const globalEnabled = permissionMap.get(`global:${feature}`);
    const isGloballyEnabled = globalEnabled !== undefined ? globalEnabled : true;

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
  ctx: QueryCtx | MutationCtx,
  feature: RbacFeature,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const user = await getUserByToken(ctx, identity.subject);
  if (isClerkAdmin(identity, user)) return true;
  if (!user) return false;

  const globalSetting = await ctx.db
    .query("role_permissions")
    .withIndex("by_role_feature", (q) =>
      q.eq("role", "global").eq("feature", feature),
    )
    .first();

  const isGloballyEnabled = globalSetting ? globalSetting.enabled : true;
  if (!isGloballyEnabled) return false;

  for (const role of user.roles ?? []) {
    if (!DYNAMIC_ROLES.includes(role as DynamicRbacRole)) continue;

    const existing = await ctx.db
      .query("role_permissions")
      .withIndex("by_role_feature", (q) =>
        q.eq("role", role).eq("feature", feature),
      )
      .first();

    if (existing?.enabled === true) return true;
    if (!existing && DEFAULT_PERMISSIONS[role as DynamicRbacRole]?.[feature]) {
      return true;
    }
  }

  return false;
}

export async function syncRolePermissions(ctx: MutationCtx, force = false) {
	const existingPermissions = await ctx.db.query("role_permissions").collect();

	if (!force && existingPermissions.length > 0) {
		return;
	}

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
				!isValidRoleFeaturePair(permission.role, permission.feature))
		) {
			await ctx.db.delete(permission._id);
		}
	}

	for (const role of DYNAMIC_ROLES) {
		const feature = ROLE_FEATURES[role];
		const existing = existingPermissions.find(
			(permission) =>
				permission.role === role && permission.feature === feature,
		);

		if (!existing) {
			await ctx.db.insert("role_permissions", {
				role,
				feature,
				enabled: DEFAULT_PERMISSIONS[role][feature],
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
    if (isClerkAdmin(identity, user)) {
      return {
        roles: [] as string[],
        features: { ...ADMIN_PERMISSIONS },
        isAdmin: true,
      };
    }

    if (!user) return { roles: [] as string[], features: {}, isAdmin: false };

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
    const perms = await ctx.db.query("role_permissions").collect();

		const result: Record<string, Record<string, boolean>> = {};
		for (const role of DYNAMIC_ROLES) {
			result[role] = {};
			const feature = ROLE_FEATURES[role];
			const perm = perms.find((p) => p.role === "global" && p.feature === feature);
			result[role][feature] = perm ? perm.enabled : true;
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

    if (!VALID_FEATURES.includes(args.feature as RbacFeature)) {
      throw new Error("Invalid feature");
    }

    await syncRolePermissions(ctx, true);

    const existing = await ctx.db
      .query("role_permissions")
      .withIndex("by_role_feature", (q) =>
        q.eq("role", "global").eq("feature", args.feature),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled });
    } else {
      await ctx.db.insert("role_permissions", {
        role: "global",
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

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const caller = await getUserByToken(ctx, identity.subject);
    if (!caller || !isClerkAdmin(identity, caller)) {
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
