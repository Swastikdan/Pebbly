import { defineSchema, defineTable } from "convex/server";

import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),

    name: v.optional(v.string()),

    image: v.optional(v.string()),

    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  watch_items: defineTable({
    userId: v.id("users"),

    tmdbId: v.number(), // TMDB ID

    mediaType: v.string(), // "movie" | "tv"

    // Membership is now decoupled from tracking state.
    // Optional during rollout to support legacy rows before backfill.
    inWatchlist: v.optional(v.boolean()),

    // New split status model
    progressStatus: v.optional(v.string()), // "want-to-watch" | "watching" | "finished"
    reaction: v.optional(v.string()), // "loved" | "liked" | "mixed" | "not-for-me"

    // Legacy combined status kept temporarily for compatibility reads/migration.
    status: v.optional(v.string()),

    progress: v.optional(v.number()), // progress percentage (0-100)

    // Metadata for display
    title: v.optional(v.string()),

    image: v.optional(v.string()),

    rating: v.optional(v.number()),

    release_date: v.optional(v.string()),

    overview: v.optional(v.string()),

    updatedAt: v.number(),
  })
    .index("by_user_media", ["userId", "tmdbId", "mediaType"])
    .index("by_user", ["userId"]),

  episode_progress: defineTable({
    userId: v.id("users"),

    tmdbId: v.number(),

    season: v.number(),

    episode: v.number(),

    isWatched: v.boolean(),

    updatedAt: v.number(),
  })
    .index("by_user_episode", ["userId", "tmdbId", "season", "episode"])
    .index("by_user_season", ["userId", "tmdbId", "season"])
    .index("by_user_media", ["userId", "tmdbId"])
    .index("by_user", ["userId"]),
});
