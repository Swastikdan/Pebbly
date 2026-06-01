import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { syncRolePermissions } from "./admin";

export const store = mutation({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }
    const userId = identity.subject;
    await syncRolePermissions(ctx);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", userId))
      .first();

    if (existing) {
      const patch: {
        name?: string;
        image?: string;
        email?: string;
        roles?: string[];
        role?: undefined;
      } = {
        name: args.name,
        image: args.image,
        email: args.email,
      };

      // TODO: Remove this legacy-role fallback after migrateLegacyUserRoles has run in production.
      if ((existing.roles?.length ?? 0) === 0 && existing.role) {
        patch.roles = Array.from(new Set([existing.role]));
        patch.role = undefined;
      }

      await ctx.db.patch(existing._id, patch);
      return existing._id;
    } else {
      const newUserId = await ctx.db.insert("users", {
        tokenIdentifier: userId,
        name: args.name,
        image: args.image,
        email: args.email,
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
