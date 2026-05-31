import { query, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

const VALID_ROLES = ["admin", "ai-integrations"] as const;
const VALID_FEATURES = ["video-player", "ai-recommendations"] as const;

export type RbacRole = (typeof VALID_ROLES)[number];
export type RbacFeature = (typeof VALID_FEATURES)[number];

const DEFAULT_PERMISSIONS: Record<RbacRole, Record<RbacFeature, boolean>> = {
  admin: {
    "video-player": true,
    "ai-recommendations": true,
  },
  "ai-integrations": {
    "video-player": false,
    "ai-recommendations": true,
  },
};

async function getUserByToken(ctx: QueryCtx | MutationCtx, tokenIdentifier: string) {
  return ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .first();
}

async function requireAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");

  const user = await getUserByToken(ctx, identity.subject);
  if (!user) throw new Error("Unauthorized");
  if (!user.roles?.includes("admin")) throw new Error("Forbidden: admin access required");

  return { identity, user };
}

function isAdmin(roles: string[] | undefined): boolean {
  return roles?.includes("admin") === true;
}

function parseClerkPublicMeta(identity: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!identity) return null;

  const candidates = [identity["public_meta"], identity["publicMetadata"]];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate === "string") {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      } catch {
        // Ignore malformed metadata claim payloads.
      }
      continue;
    }

    if (typeof candidate === "object") return candidate as Record<string, unknown>;
  }

  return null;
}

function getLegacyFeatureAccess(identity: Record<string, unknown> | null, feature: RbacFeature): boolean | null {
  const meta = parseClerkPublicMeta(identity);
  if (!meta) return null;

  if (feature === "ai-recommendations") {
    if (meta.aiGenerationEnabled === true) return true;
    return meta.aiGenerationEnabled === false ? false : null;
  }

  if (feature === "video-player") {
    return meta.isAdmin === true ? true : null;
  }

  return null;
}

async function computeRoleFeatures(ctx: QueryCtx | MutationCtx, roles: string[]): Promise<Record<string, boolean>> {
  const features: Record<string, boolean> = {};

  for (const feature of VALID_FEATURES) {
    let enabled = false;
    for (const role of roles) {
      if (!VALID_ROLES.includes(role as RbacRole)) continue;

      const existing = await ctx.db
        .query("role_permissions")
        .withIndex("by_role_feature", (q) => q.eq("role", role).eq("feature", feature))
        .first();

      if (existing) {
        if (existing.enabled) enabled = true;
      } else {
        if (DEFAULT_PERMISSIONS[role as RbacRole]?.[feature] === true) enabled = true;
      }
    }
    features[feature] = enabled;
  }

  return features;
}

export async function hasFeature(ctx: QueryCtx | MutationCtx, feature: RbacFeature): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const user = await getUserByToken(ctx, identity.subject);
  if (!user) return false;

  if (user.roles && user.roles.length > 0) {
    for (const role of user.roles) {
      if (!VALID_ROLES.includes(role as RbacRole)) continue;

      const existing = await ctx.db
        .query("role_permissions")
        .withIndex("by_role_feature", (q) => q.eq("role", role).eq("feature", feature))
        .first();

      if (existing?.enabled === true) return true;

      if (!existing && DEFAULT_PERMISSIONS[role as RbacRole]?.[feature] === true) return true;
    }

    return false;
  }

  const legacy = getLegacyFeatureAccess(identity, feature);
  if (legacy !== null) return legacy;

  return false;
}

async function ensureRolePermissionsSeeded(ctx: MutationCtx) {
  for (const role of VALID_ROLES) {
    for (const feature of VALID_FEATURES) {
      const existing = await ctx.db
        .query("role_permissions")
        .withIndex("by_role_feature", (q) => q.eq("role", role).eq("feature", feature))
        .first();

      if (!existing) {
        await ctx.db.insert("role_permissions", {
          role,
          feature,
          enabled: DEFAULT_PERMISSIONS[role][feature],
        });
      }
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

    if (user.roles && user.roles.length > 0) {
      const features = await computeRoleFeatures(ctx, user.roles);

      return {
        roles: user.roles,
        features,
        isAdmin: isAdmin(user.roles),
      };
    }

    // Legacy: user has no Convex roles yet, read from Clerk metadata
    const features: Record<string, boolean> = {};
    for (const feature of VALID_FEATURES) {
      features[feature] = getLegacyFeatureAccess(identity, feature) ?? false;
    }

    return {
      roles: [] as string[],
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
    for (const role of VALID_ROLES) {
      result[role] = {};
      for (const feature of VALID_FEATURES) {
        const perm = perms.find((p) => p.role === role && p.feature === feature);
        result[role][feature] = perm ? perm.enabled : (DEFAULT_PERMISSIONS[role]?.[feature] ?? false);
      }
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

    if (!VALID_ROLES.includes(args.role as RbacRole)) throw new Error("Invalid role");
    if (!VALID_FEATURES.includes(args.feature as RbacFeature)) throw new Error("Invalid feature");

    await ensureRolePermissionsSeeded(ctx);

    const existing = await ctx.db
      .query("role_permissions")
      .withIndex("by_role_feature", (q) => q.eq("role", args.role).eq("feature", args.feature))
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
    roles: v.array(v.union(v.literal("admin"), v.literal("ai-integrations"))),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireAdmin(ctx);

    const target = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();

    if (!target) throw new Error("User not found");

    const isSelf = target.tokenIdentifier === identity.subject;

    if (isSelf && !args.roles.includes("admin")) {
      throw new Error("You cannot remove your own admin role. Ask another admin to demote you.");
    }

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
    if (!caller || !isAdmin(caller.roles)) throw new Error("Forbidden: admin access required");

    const users = await ctx.db.query("users").collect();

    return users.map((u) => ({
      _id: u._id,
      tokenIdentifier: u.tokenIdentifier,
      name: u.name ?? "Anonymous",
      email: u.email ?? "No email",
      image: u.image,
      roles: u.roles ?? [],
    }));
  },
});
