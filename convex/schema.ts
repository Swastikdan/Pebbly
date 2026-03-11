import { defineSchema, defineTable } from "convex/server";

import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),

    name: v.optional(v.string()),

    image: v.optional(v.string()),

    email: v.optional(v.string()),

	    role: v.optional(v.string()),
    aiGenerationEnabled: v.optional(v.boolean()),
  }).index("by_token", ["tokenIdentifier"]),

  watch_items: defineTable({
    userId: v.id("users"),

	    tmdbId: v.number(),

	    mediaType: v.string(),

    inWatchlist: v.optional(v.boolean()),

	    progressStatus: v.optional(v.string()),
	    reaction: v.optional(v.string()),

    status: v.optional(v.string()),

	    progress: v.optional(v.number()),

    title: v.optional(v.string()),

    image: v.optional(v.string()),

    rating: v.optional(v.number()),

    release_date: v.optional(v.string()),

    overview: v.optional(v.string()),

    updatedAt: v.number(),
  })
    .index("by_user_media", ["userId", "tmdbId", "mediaType"])
    .index("by_user", ["userId"]),

  lists: defineTable({
    userId: v.id("users"),
    name: v.string(),
    color: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  list_items: defineTable({
    userId: v.id("users"),
    listId: v.id("lists"),
    tmdbId: v.number(),
    mediaType: v.string(),
    addedAt: v.number(),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  })
    .index("by_list", ["listId"])
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

  ai_recommendations: defineTable({
    userId: v.id("users"),
	    recommendations: v.string(),
	    originalRecommendations: v.optional(v.string()),
    watchlistHash: v.string(),
    inputStats: v.object({
      movieCount: v.number(),
      tvCount: v.number(),
      episodesWatched: v.number(),
      totalItems: v.number(),
    }),
    model: v.string(),
    mediaTypePreference: v.optional(v.string()),
    genrePreference: v.optional(v.string()),
	    generationType: v.optional(v.string()),
	    verified: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
