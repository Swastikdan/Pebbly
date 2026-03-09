import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";

// ─── Internal helpers ────────────────────────────────────────────────

/** Validate auth + role + feature flag. Returns user doc or throws. */
export const getAuthorizedUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .first();
    if (!user) throw new Error("Unauthorized");
    if (!user.aiGenerationEnabled)
      throw new Error("Unauthorized: feature not enabled");

    return user;
  },
});

/** Collect all watchlist data for the authenticated user. */
export const gatherWatchlistData = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .first();
    if (!user) throw new Error("Unauthorized");

    const watchItems = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const lists = await ctx.db
      .query("lists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const listItems = await ctx.db
      .query("list_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const episodeProgress = await ctx.db
      .query("episode_progress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const watchedEpisodes = episodeProgress.filter((e) => e.isWatched).length;

    const movieCount = watchItems.filter(
      (i) => i.mediaType === "movie",
    ).length;
    const tvCount = watchItems.filter((i) => i.mediaType === "tv").length;

    return {
      watchItems,
      lists,
      listItems,
      inputStats: {
        movieCount,
        tvCount,
        episodesWatched: watchedEpisodes,
        totalItems: watchItems.length,
      },
    };
  },
});

/** Save recommendations for a user (appends to history). */
export const saveRecommendations = internalMutation({
  args: {
    userId: v.id("users"),
    recommendations: v.string(),
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ai_recommendations", {
      userId: args.userId,
      recommendations: args.recommendations,
      watchlistHash: args.watchlistHash,
      inputStats: args.inputStats,
      model: args.model,
      mediaTypePreference: args.mediaTypePreference,
      genrePreference: args.genrePreference,
      generationType: args.generationType,
      createdAt: Date.now(),
    });
  },
});

/** Admin utility: set role and aiGenerationEnabled on a user. */
export const setUserRole = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    role: v.string(),
    aiGenerationEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      role: args.role,
      aiGenerationEnabled: args.aiGenerationEnabled,
    });
  },
});

// ─── Public queries ──────────────────────────────────────────────────

/** Client-facing access check. */
export const getUserRecommendationAccess = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity)
      return { hasAccess: false, reason: "not_authenticated" as const };

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .first();

    if (!user) return { hasAccess: false, reason: "user_not_found" as const };
    if (!user.aiGenerationEnabled)
      return { hasAccess: false, reason: "feature_disabled" as const };

    return { hasAccess: true };
  },
});

/** Return all recommendation history for the user, sorted newest first. */
export const getRecommendationHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .first();
    if (!user) return [];
    if ((user as any).aiGenerationEnabled === false) return [];

    const entries = await ctx.db
      .query("ai_recommendations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return entries.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Delete a specific recommendation entry. */
export const deleteRecommendation = mutation({
  args: { id: v.id("ai_recommendations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .first();
    if (!user || entry.userId !== user._id) throw new Error("Unauthorized");

    await ctx.db.delete(args.id);
  },
});

// ─── Action: generate recommendations ────────────────────────────────

// The user experienced 503 errors with gemini-3-flash-preview.
// We'll use a list of fallback models and try them sequentially.
const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];
const RATE_LIMIT_MS = 2 * 60 * 1000; // 2 minutes

function computeHash(
  items: Array<{ tmdbId: number; progressStatus?: string; reaction?: string }>,
  mediaTypePreference?: string,
  genrePreference?: string,
): string {
  const sorted = items
    .map((i) => `${i.tmdbId}:${i.progressStatus ?? ""}:${i.reaction ?? ""}`)
    .sort();
  let hash = 0;
  const str = sorted.join("|") + `|mt:${mediaTypePreference ?? ""}|g:${genrePreference ?? ""}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

type WatchlistData = {
  watchItems: Array<{
    tmdbId: number;
    mediaType: string;
    title?: string;
    rating?: number;
    progressStatus?: string;
    reaction?: string;
    progress?: number;
  }>;
  lists: Array<{ name: string; _id: any }>;
  listItems: Array<{ listId: any; tmdbId: number; mediaType: string }>;
  inputStats: {
    movieCount: number;
    tvCount: number;
    episodesWatched: number;
    totalItems: number;
  };
};

function buildWatchlistPrompt(
  data: WatchlistData,
  mediaTypePreference?: string,
  excludeTmdbIds: number[] = [],
): string {
  const { watchItems, lists, listItems, inputStats } = data;

  const loved = watchItems.filter(
    (i) => i.reaction === "loved" || i.reaction === "liked",
  );
  const watching = watchItems.filter(
    (i) => i.progressStatus === "watching",
  );
  const watchLater = watchItems.filter(
    (i) => i.progressStatus === "watch-later",
  );
  const disliked = watchItems.filter(
    (i) =>
      i.reaction === "not-for-me" ||
      i.reaction === "mixed" ||
      i.progressStatus === "dropped",
  );
  const done = watchItems.filter(
    (i) => i.progressStatus === "done" && i.reaction !== "loved" && i.reaction !== "liked",
  );

  const formatItem = (i: (typeof watchItems)[0]) => {
    const parts = [`- ${i.title ?? "Unknown"} (TMDB ID: ${i.tmdbId}, ${i.mediaType})`];
    if (i.rating) parts.push(`Rating: ${i.rating}/10`);
    if (i.reaction) parts.push(`Reaction: ${i.reaction}`);
    return parts.join(" | ");
  };

  const prioritized = new Set(
    [...loved, ...watching, ...done, ...watchLater, ...disliked]
      .slice(0, 50)
      .map((i) => i.tmdbId),
  );
  const existingIds = [...watchItems.map((i) => i.tmdbId), ...excludeTmdbIds];
  const inScope = (i: (typeof watchItems)[0]) => prioritized.has(i.tmdbId);

  let prompt = `Here is my watchlist data:\n\n`;

  const scopedLoved = loved.filter(inScope);
  const scopedWatching = watching.filter(inScope);
  const scopedDone = done.filter(inScope);
  const scopedWatchLater = watchLater.filter(inScope);
  const scopedDisliked = disliked.filter(inScope);

  if (scopedLoved.length > 0) {
    prompt += `## Content I loved/liked:\n${scopedLoved.map(formatItem).join("\n")}\n\n`;
  }
  if (scopedWatching.length > 0) {
    prompt += `## Currently watching:\n${scopedWatching.map(formatItem).join("\n")}\n\n`;
  }
  if (scopedDone.length > 0) {
    prompt += `## Completed (no strong reaction):\n${scopedDone.map(formatItem).join("\n")}\n\n`;
  }
  if (scopedWatchLater.length > 0) {
    prompt += `## On my watch-later list:\n${scopedWatchLater.map(formatItem).join("\n")}\n\n`;
  }
  if (scopedDisliked.length > 0) {
    prompt += `## Content I didn't enjoy (dropped/mixed/not-for-me):\n${scopedDisliked.map(formatItem).join("\n")}\n\n`;
  }

  if (lists.length > 0) {
    prompt += `## My custom lists:\n`;
    for (const list of lists) {
      const items = listItems.filter((li) => li.listId === list._id);
      const titles = items
        .map((li) => {
          const wi = watchItems.find(
            (w) => w.tmdbId === li.tmdbId && w.mediaType === li.mediaType,
          );
          return wi?.title ?? `TMDB:${li.tmdbId}`;
        })
        .join(", ");
      prompt += `- "${list.name}": ${titles}\n`;
    }
    prompt += "\n";
  }

  prompt += `## Stats:\n- ${inputStats.movieCount} movies, ${inputStats.tvCount} TV shows tracked\n- ${inputStats.episodesWatched} episodes watched\n\n`;

  if (mediaTypePreference === "movie") {
    prompt += `IMPORTANT: Only recommend MOVIES. Do not suggest any TV shows.\n\n`;
  } else if (mediaTypePreference === "tv") {
    prompt += `IMPORTANT: Only recommend TV SHOWS. Do not suggest any movies.\n\n`;
  }

  const mediaLabel = mediaTypePreference === "movie" ? "movies" : mediaTypePreference === "tv" ? "TV shows" : "movies and TV shows";
  prompt += `Based on this data, recommend 10-15 ${mediaLabel} I would likely enjoy.\n`;
  prompt += `Do NOT recommend any title with these TMDB IDs (already in my watchlist): ${existingIds.join(", ")}\n\n`;
  prompt += RESPONSE_SCHEMA;

  return prompt;
}

function buildGenrePrompt(
  data: WatchlistData,
  mediaTypePreference?: string,
  genrePreference?: string,
  excludeTmdbIds: number[] = [],
): string {
  const existingIds = [...data.watchItems.map((i) => i.tmdbId), ...excludeTmdbIds];

  const mediaLabel = mediaTypePreference === "movie" ? "movies" : mediaTypePreference === "tv" ? "TV shows" : "movies and TV shows";

  let prompt = `Recommend me 10-15 popular and highly-rated ${mediaLabel}`;

  if (genrePreference) {
    prompt += ` in these genres: ${genrePreference}`;
  }
  prompt += `.\n\n`;

  prompt += `Focus on well-known, critically acclaimed titles that are widely loved. Include a mix of classic and recent titles.\n\n`;

  if (mediaTypePreference === "movie") {
    prompt += `IMPORTANT: Only recommend MOVIES. Do not suggest any TV shows.\n\n`;
  } else if (mediaTypePreference === "tv") {
    prompt += `IMPORTANT: Only recommend TV SHOWS. Do not suggest any movies.\n\n`;
  }

  if (existingIds.length > 0) {
    prompt += `Do NOT recommend any title with these TMDB IDs (already in my watchlist): ${existingIds.join(", ")}\n\n`;
  }

  prompt += RESPONSE_SCHEMA;
  return prompt;
}

const RESPONSE_SCHEMA = `Respond with this exact JSON schema:
{
  "recommendations": [
    {
      "title": "string - exact official title",
      "tmdbId": "number or null if unknown",
      "mediaType": "movie" or "tv",
      "relevanceScore": "number 0-100",
      "reasoning": "string - 1-2 sentence explanation"
    }
  ]
}`;

/** Internal query to get most recent recommendation for rate limiting. */
export const getMostRecentEntry = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("ai_recommendations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (entries.length === 0) return null;
    return entries.sort((a, b) => b.createdAt - a.createdAt)[0];
  },
});

interface Recommendation {
  title: string;
  tmdbId: number | null;
  mediaType: "movie" | "tv";
  relevanceScore: number;
  reasoning: string;
}

interface InputStats {
  movieCount: number;
  tvCount: number;
  episodesWatched: number;
  totalItems: number;
}

type GenerateResult =
  | { recommendations: Recommendation[]; inputStats: InputStats; generatedAt: number; cached: boolean }
  | { error: string };

export const generateRecommendations = action({
  args: {
    generationType: v.optional(v.union(v.literal("watchlist"), v.literal("genre"))),
    mediaTypePreference: v.optional(v.union(v.literal("movie"), v.literal("tv"))),
    genrePreference: v.optional(v.string()),
    excludeTmdbIds: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args): Promise<GenerateResult> => {
    const genType = args.generationType ?? "watchlist";
    const excludeTmdbIds = args.excludeTmdbIds ?? [];

    // 1. Auth check
    const user = await ctx.runQuery(
      internal.recommendations.getAuthorizedUser,
    );

    // 2. Gather watchlist data
    const data = await ctx.runQuery(
      internal.recommendations.gatherWatchlistData,
    );

    // 3. For watchlist-based, require non-empty watchlist
    if (genType === "watchlist" && data.watchItems.length === 0) {
      return { error: "empty_watchlist" };
    }

    // 4. Rate limit: check most recent entry (skip if we are generating more)
    const isGenerateMore = excludeTmdbIds.length > 0;
    const mostRecent = await ctx.runQuery(
      internal.recommendations.getMostRecentEntry,
      { userId: user._id },
    );

    if (!isGenerateMore && mostRecent && Date.now() - mostRecent.createdAt < RATE_LIMIT_MS) {
      return { error: "rate_limited" };
    }

    // 5. Build prompt based on generation type
    const userPrompt = genType === "watchlist"
      ? buildWatchlistPrompt(data, args.mediaTypePreference, excludeTmdbIds)
      : buildGenrePrompt(data, args.mediaTypePreference, args.genrePreference, excludeTmdbIds);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set in Convex environment variables");
      return { error: "api_unavailable" };
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction =
      "You are a movie and TV show recommendation engine. You analyze a user's watchlist and viewing preferences to suggest titles they would enjoy. You MUST only recommend real, existing movies and TV shows. Never invent fictional titles. Return your response as a JSON object with the exact schema specified by the user.";

    // 6. Call Gemini (try models sequentially)
    let responseText = "";
    let usedModel = MODELS_TO_TRY[0];
    let success = false;
    let highDemandError = false;

    // A small helper to delay between retries
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < MODELS_TO_TRY.length; i++) {
        usedModel = MODELS_TO_TRY[i];
        try {
            const response = await ai.models.generateContent({
              model: usedModel,
              contents: userPrompt,
              config: {
                responseMimeType: "application/json",
                systemInstruction,
              },
            });
            responseText = response.text ?? "";
            
            if (responseText) {
                success = true;
                break;
            }
        } catch (err: any) {
            console.error(`Gemini model (${usedModel}) error:`, err?.message ?? err);
            
            // Check if it's a 503 high demand error
            if (err?.status === 503 || err?.message?.includes("high demand") || err?.message?.includes("503")) {
                highDemandError = true;
            }
            
            // Wait slightly before trying the next model
            if (i < MODELS_TO_TRY.length - 1) {
                await delay(1000); // 1s second delay before next fallback
            }
        }
    }

    if (!success) {
        if (highDemandError) {
             return { error: "high_demand" };
        }
        return { error: "api_unavailable" };
    }

    // 7. Parse and validate
    let parsed: { recommendations: Recommendation[] };
    try {
      parsed = JSON.parse(responseText);
      if (!Array.isArray(parsed.recommendations)) {
        return { error: "invalid_response" };
      }
    } catch {
      return { error: "invalid_response" };
    }

    // 8. Filter out titles already in watchlist
    const existingIds = new Set(data.watchItems.map((i: { tmdbId: number }) => i.tmdbId));
    parsed.recommendations = parsed.recommendations.filter(
      (r) => r.tmdbId == null || !existingIds.has(r.tmdbId),
    );

    // 9. Save to history
    const watchlistHash = computeHash(data.watchItems, args.mediaTypePreference, args.genrePreference);
    await ctx.runMutation(internal.recommendations.saveRecommendations, {
      userId: user._id,
      recommendations: JSON.stringify(parsed.recommendations),
      watchlistHash,
      inputStats: data.inputStats,
      model: usedModel,
      mediaTypePreference: args.mediaTypePreference,
      genrePreference: args.genrePreference,
      generationType: genType,
    });

    return {
      recommendations: parsed.recommendations,
      inputStats: data.inputStats,
      generatedAt: Date.now(),
      cached: false,
    };
  },
});
