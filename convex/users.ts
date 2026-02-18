import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

    // Check if user exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", userId))
      .first();

    if (existing) {
      // Update
      await ctx.db.patch(existing._id, {
        name: args.name,
        image: args.image,
        email: args.email,
      });
      return existing._id;
    } else {
      // Create
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
