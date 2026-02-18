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
    userId: v.string(),
    tmdbId: v.number(), // TMDB ID
    mediaType: v.string(), // "movie" | "tv"
    status: v.string(), // "watching", "completed", "plan_to_watch"
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
    userId: v.string(),
    tmdbId: v.number(),
    season: v.number(),
    episode: v.number(),
    isWatched: v.boolean(),
    updatedAt: v.number(),
  })
  .index("by_user_episode", ["userId", "tmdbId", "season", "episode"])
  .index("by_user_season", ["userId", "tmdbId", "season"])
  .index("by_user_media", ["userId", "tmdbId"]),
});
