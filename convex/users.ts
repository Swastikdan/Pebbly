import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { syncRolePermissions } from "./admin";

/**
 * Returns `true`/`false` when the JWT explicitly includes `isAdmin`,
 * or `null` when the JWT doesn't carry the claim at all (stale token).
 *
 * Clerk puts public metadata in the JWT under `public_meta` (snake_case in token claims)
 * or `publicMetadata` (camelCase in some SDK versions).
 */
function getAdminFromJwt(
  identity: Record<string, unknown>,
): boolean | null {
  const meta =
    (identity.public_meta as Record<string, unknown> | undefined) ??
    (identity.publicMetadata as Record<string, unknown> | undefined);
  if (meta && typeof meta === "object" && "isAdmin" in meta) {
    return meta.isAdmin === true;
  }
  return null;
}

export const store = mutation({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }
    const userId = identity.subject;
    await syncRolePermissions(ctx);

    const adminFromJwt = getAdminFromJwt(identity);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", userId))
      .first();

    if (existing) {
      const update: Record<string, unknown> = {
        name: args.name,
        image: args.image,
        email: args.email,
      };
      // JWT claim is the source of truth. Fall back to the client-provided
      // value (from Clerk's useUser().publicMetadata) when the JWT is stale
      // and doesn't carry isAdmin at all.
      if (adminFromJwt !== null) {
        update.isAdmin = adminFromJwt;
      } else if (args.isAdmin !== undefined) {
        update.isAdmin = args.isAdmin;
      }
      await ctx.db.patch(existing._id, update);
      return existing._id;
    } else {
      const resolvedAdmin = adminFromJwt ?? args.isAdmin ?? false;
      const newUserId = await ctx.db.insert("users", {
        tokenIdentifier: userId,
        name: args.name,
        image: args.image,
        email: args.email,
        isAdmin: resolvedAdmin,
      });
      return newUserId;
    }
  },
});

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();
    return user;
  },
});
