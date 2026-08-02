import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { hasFeature } from "./admin";
import { callGeminiAI, MODELS_TO_TRY, type Recommendation } from "./ai";
import {
  buildWatchlistPrompt,
  buildCustomListPrompt,
  buildGenrePrompt,
  buildHomepageRecommendationsPrompt,
  type FeedbackSignals,
} from "./prompts";

type RecommendationsContext = QueryCtx | MutationCtx;
type RecommendationUser = Doc<"users">;
type RecommendationEntry = Doc<"ai_recommendations">;
export type WatchItemSummary = Pick<
  Doc<"watch_items">,
  "tmdbId" | "mediaType" | "title" | "rating" | "progressStatus" | "reaction" | "progress"
>;
export type CustomListSummary = Pick<Doc<"lists">, "_id" | "name">;
export type CustomListItemSummary = Pick<
  Doc<"list_items">,
  "listId" | "tmdbId" | "mediaType"
>;

async function getUserByTokenIdentifier(
  ctx: RecommendationsContext,
  tokenIdentifier: string,
) {
  return ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .first();
}

async function requireAuthenticatedUser(
  ctx: RecommendationsContext,
): Promise<RecommendationUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }

  const user = await getUserByTokenIdentifier(ctx, identity.subject);
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

async function requireOwnedRecommendationEntry(
  ctx: MutationCtx,
  id: Id<"ai_recommendations">,
): Promise<RecommendationEntry> {
  const user = await requireAuthenticatedUser(ctx);
  const entry = await ctx.db.get(id);

  if (!entry) {
    throw new Error("Not found");
  }

  if (entry.userId !== user._id) {
    throw new Error("Unauthorized");
  }

  return entry;
}

export const getAuthorizedUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);

    if (!(await hasFeature(ctx, "ai-recommendations"))) {
      throw new Error("Unauthorized: feature not enabled");
    }

    return user;
  },
});

export const gatherWatchlistData = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);

    const watchItems = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(200);

    const lists = await ctx.db
      .query("lists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(50);

    const listItems = await ctx.db
      .query("list_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(200);

    const episodeProgress = await ctx.db
      .query("episode_progress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(200);

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

export const getUserRecommendationAccess = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { hasAccess: false, reason: "not_authenticated" as const };
    }

    if (!(await hasFeature(ctx, "ai-recommendations"))) {
      return { hasAccess: false, reason: "feature_disabled" as const };
    }

    return { hasAccess: true };
  },
});

export const getRecommendationHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    if (!(await hasFeature(ctx, "ai-recommendations"))) return [];

    const user = await getUserByTokenIdentifier(ctx, identity.subject);
    if (!user) return [];

    return ctx.db
      .query("ai_recommendations")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const deleteRecommendation = mutation({
  args: { id: v.id("ai_recommendations") },
  handler: async (ctx, args) => {
    await requireOwnedRecommendationEntry(ctx, args.id);

    await ctx.db.delete(args.id);
  },
});

export const updateVerifiedRecommendations = mutation({
  args: {
    id: v.id("ai_recommendations"),
    recommendations: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await requireOwnedRecommendationEntry(ctx, args.id);

    const patch: Record<string, unknown> = {
      recommendations: args.recommendations,
      verified: true,
    };
    if (!entry.originalRecommendations) {
      patch.originalRecommendations = entry.recommendations;
    }

    await ctx.db.patch(args.id, patch);
  },
});


const RATE_LIMIT_MS = 2 * 60 * 1000;

function computeHash(
  items: Array<{
    tmdbId: number;
    progressStatus?: string;
    reaction?: string | null;
  }>,
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

function normalizeTitleKey(title?: string | null): string {
  return (title ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type WatchlistData = {
  watchItems: WatchItemSummary[];
  lists: CustomListSummary[];
  listItems: CustomListItemSummary[];
  inputStats: {
    movieCount: number;
    tvCount: number;
    episodesWatched: number;
    totalItems: number;
  };
};





















export const checkAndSetRecommendationCooldown = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const mostRecent = await ctx.db
      .query("ai_recommendations")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    const now = Date.now();
    if (mostRecent && now - mostRecent.createdAt < RATE_LIMIT_MS) {
      return false;
    }

    await ctx.db.insert("ai_recommendations", {
      userId: args.userId,
      recommendations: "[]",
      watchlistHash: "",
      inputStats: { movieCount: 0, tvCount: 0, episodesWatched: 0, totalItems: 0 },
      model: "placeholder",
      createdAt: now,
    });

    return true;
  },
});

export const getMostRecentEntry = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("ai_recommendations")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
  },
});

export const getHomepageAttemptInfo = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("homepage_recommendations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return entry
      ? { lastAttemptedAt: entry.lastAttemptedAt, status: entry.status }
      : null;
  },
});

export const getHomepageRecommendationEntryInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("homepage_recommendations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});



interface InputStats {
  movieCount: number;
  tvCount: number;
  episodesWatched: number;
  totalItems: number;
}

type GenerateResult =
  | {
      recommendations: Recommendation[];
      inputStats: InputStats;
      generatedAt: number;
      cached: boolean;
    }
  | { error: string };



export const generateRecommendations = action({
  args: {
    generationType: v.optional(v.string()),
    listId: v.optional(v.string()),
    mediaTypePreference: v.optional(v.union(v.literal("movie"), v.literal("tv"))),
    genrePreference: v.optional(v.string()),
    excludeTmdbIds: v.optional(v.array(v.number())),
    yearFrom: v.optional(v.number()),
    yearTo: v.optional(v.number()),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<GenerateResult> => {
    const genType = args.generationType ?? "watchlist";

    const user = await ctx.runQuery(
      internal.recommendations.getAuthorizedUser,
    );

    const data = await ctx.runQuery(
      internal.recommendations.gatherWatchlistData,
    );

    if (genType === "watchlist" && data.watchItems.length === 0) {
      return { error: "empty_watchlist" };
    }
    if (genType === "list" && args.listId) {
      if (data.listItems.filter((li) => li.listId === args.listId).length === 0) {
        return { error: "empty_watchlist" };
      }
    }

    const allowed = await ctx.runMutation(
      internal.recommendations.checkAndSetRecommendationCooldown,
      { userId: user._id },
    );

    if (!allowed) {
      return { error: "rate_limited" };
    }

    const feedbackList = await ctx.runQuery(
      internal.recommendations.getRecommendationFeedbackInternal,
    );

    const likedTitles = feedbackList
      .filter((f) => f.feedback === "like")
      .map((f) => f.title);
    const dislikedTitles = feedbackList
      .filter((f) => f.feedback === "not_interested")
      .map((f) => f.title);
    const dislikedTmdbIds = feedbackList
      .filter((f) => f.feedback === "not_interested")
      .map((f) => f.tmdbId);

    const excludeTmdbIds = [
      ...new Set([...(args.excludeTmdbIds ?? []), ...dislikedTmdbIds]),
    ];

    const feedbackSignals: FeedbackSignals = {
      likedTitles,
      dislikedTitles,
      dislikedTmdbIds,
    };

    const userPrompt =
      genType === "watchlist"
        ? buildWatchlistPrompt(
            data,
            args.mediaTypePreference,
            excludeTmdbIds,
            args.yearFrom,
            args.yearTo,
            args.count,
            feedbackSignals,
          )
        : genType === "list" && args.listId
          ? buildCustomListPrompt(
              data,
              args.listId,
              args.mediaTypePreference,
              excludeTmdbIds,
              args.yearFrom,
              args.yearTo,
              args.count,
              feedbackSignals,
            )
          : buildGenrePrompt(
              data,
              args.mediaTypePreference,
              args.genrePreference,
              excludeTmdbIds,
              args.yearFrom,
              args.yearTo,
              args.count,
              feedbackSignals,
            );

    const systemInstruction =
      "You are a movie and TV show recommendation engine. You analyze a user's watchlist and viewing preferences to suggest titles they would enjoy. You MUST only recommend real, existing movies and TV shows. Never invent fictional titles. Return your response as a JSON object with the exact schema specified by the user.";

    const aiResult = await callGeminiAI(userPrompt, systemInstruction, 1);
    if (aiResult.error || !aiResult.result) {
      return { error: aiResult.error ?? "api_unavailable" };
    }
    const parsed = aiResult.result;
    const usedModel = aiResult.usedModel ?? MODELS_TO_TRY[0];

    const existingIds = new Set([
      ...data.watchItems.map((item) => item.tmdbId),
      ...excludeTmdbIds,
    ]);
    const existingTitles = new Set(
      data.watchItems.map((item) => normalizeTitleKey(item.title)),
    );
    parsed.recommendations = parsed.recommendations.filter(
      (r) =>
        (r.tmdbId == null || !existingIds.has(r.tmdbId)) &&
        !existingTitles.has(normalizeTitleKey(r.title)),
    );

    const watchlistHash = computeHash(
      data.watchItems,
      args.mediaTypePreference,
      args.genrePreference,
    );
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

export const getHomepageRecommendations = query({
  args: {
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return null;

    const dbUser = await getUserByTokenIdentifier(ctx, user.subject);
    if (!dbUser) return null;

    const entry = await ctx.db
      .query("homepage_recommendations")
      .withIndex("by_user", (q) => q.eq("userId", dbUser._id))
      .first();

    const userFeedback = await ctx.db
      .query("recommendation_feedback")
      .withIndex("by_user", (q) => q.eq("userId", dbUser._id))
      .collect();

    const excludedFeedbackIds = new Set(
      userFeedback
        .filter((f) => f.feedback === "not_interested" || f.feedback === "dislike")
        .map((f) => f.tmdbId),
    );

    // NEW: Also filter out any items already in the user's watchlist!
    const watchItems = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", dbUser._id))
      .take(500);
    const watchlistTmdbIds = new Set(watchItems.map((w) => w.tmdbId));
    const watchlistTitles = new Set(
      watchItems.map((w) => normalizeTitleKey(w.title)),
    );

    let recs: Recommendation[] = [];
    if (entry && entry.recommendations) {
      try {
        const parsed = JSON.parse(entry.recommendations) as Recommendation[];
        recs = parsed.filter(
          (r) =>
            (r.tmdbId === null || !excludedFeedbackIds.has(r.tmdbId)) &&
            (r.tmdbId === null || !watchlistTmdbIds.has(r.tmdbId)) &&
            !watchlistTitles.has(normalizeTitleKey(r.title)),
        );
      } catch (e) {
        console.error("Failed to parse homepage recommendations", e);
      }
    }

    const lastAttemptedAt = entry?.lastAttemptedAt ?? 0;
    const lastUpdatedAt = entry?.lastUpdatedAt ?? 0;
    const status = entry?.status ?? "none";

    const currentTime = args.now ?? Date.now();
    const isOlderThan24Hours = currentTime > 0 && (currentTime - lastAttemptedAt > 24 * 60 * 60 * 1000);
    const hasFailedRecently = status === "failed" && currentTime > 0 && (currentTime - lastAttemptedAt < 1 * 60 * 60 * 1000);
    const needsRefresh = !entry || (isOlderThan24Hours && !hasFailedRecently);

    return {
      recommendations: recs,
      lastUpdatedAt,
      lastAttemptedAt,
      status,
      needsRefresh,
    };
  },
});

export const setRecommendationFeedback = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
    title: v.string(),
    feedback: v.union(v.literal("not_interested"), v.literal("like")),
    image: v.optional(v.string()),
    backdrop: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const now = Date.now();

    // Save feedback
    const existing = await ctx.db
      .query("recommendation_feedback")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        feedback: args.feedback,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("recommendation_feedback", {
        userId: user._id,
        tmdbId: args.tmdbId,
        mediaType: args.mediaType,
        title: args.title,
        feedback: args.feedback,
        updatedAt: now,
      });
    }

    // When user likes a recommendation, auto-add to watchlist with "recommended" reaction & Pebbly Picks list
    if (args.feedback === "like") {
      // Add to user's main watchlist
      const existingWatchItem = await ctx.db
        .query("watch_items")
        .withIndex("by_user_media", (q) =>
          q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType)
        )
        .first();

      if (existingWatchItem) {
        await ctx.db.patch(existingWatchItem._id, {
          inWatchlist: true,
          reaction: existingWatchItem.reaction ?? "recommended",
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("watch_items", {
          userId: user._id,
          tmdbId: args.tmdbId,
          mediaType: args.mediaType,
          inWatchlist: true,
          progressStatus: "watch-later",
          reaction: "recommended",
          title: args.title,
          image: args.image,
          rating: args.rating,
          release_date: args.release_date,
          overview: args.overview,
          updatedAt: now,
        });
      }

      // Find or create the Pebbly Picks list
      let pebblyList = await ctx.db
        .query("lists")
        .withIndex("by_user_name", (q) => q.eq("userId", user._id).eq("name", "Pebbly Picks"))
        .first();

      if (!pebblyList) {
        const listId = await ctx.db.insert("lists", {
          userId: user._id,
          name: "Pebbly Picks",
          listType: "pebbly-picks",
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
        });
        pebblyList = await ctx.db.get(listId);
      }

      if (pebblyList) {
        const existingItem = await ctx.db
          .query("list_items")
          .withIndex("by_list_media", (q) =>
            q.eq("listId", pebblyList._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
          )
          .first();

        if (!existingItem) {
          await ctx.db.insert("list_items", {
            userId: user._id,
            listId: pebblyList._id,
            tmdbId: args.tmdbId,
            mediaType: args.mediaType,
            addedAt: now,
            title: args.title,
            image: args.image,
            backdrop: args.backdrop,
            rating: args.rating,
            release_date: args.release_date,
            overview: args.overview,
          });
        }
      }
    }
  },
});

export const removeRecommendationFeedback = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const existing = await ctx.db
      .query("recommendation_feedback")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getRecommendationFeedback = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return [];

    const dbUser = await getUserByTokenIdentifier(ctx, user.subject);
    if (!dbUser) return [];

    return ctx.db
      .query("recommendation_feedback")
      .withIndex("by_user", (q) => q.eq("userId", dbUser._id))
      .collect();
  },
});

export const getRecommendationFeedbackInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);

    return ctx.db
      .query("recommendation_feedback")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const saveHomepageRecommendations = internalMutation({
  args: {
    userId: v.id("users"),
    recommendations: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("homepage_recommendations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        previousRecommendations: existing.recommendations,
        recommendations: args.recommendations,
        lastAttemptedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: "success",
      });
    } else {
      await ctx.db.insert("homepage_recommendations", {
        userId: args.userId,
        recommendations: args.recommendations,
        lastAttemptedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: "success",
      });
    }
  },
});

export const saveHomepageFailure = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("homepage_recommendations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastAttemptedAt: Date.now(),
        status: "failed",
      });
    } else {
      await ctx.db.insert("homepage_recommendations", {
        userId: args.userId,
        recommendations: "[]",
        lastAttemptedAt: Date.now(),
        lastUpdatedAt: 0,
        status: "failed",
      });
    }
  },
});



export const generateHomepageRecommendations = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
    const user = await ctx.runQuery(internal.recommendations.getAuthorizedUser);
    const data = await ctx.runQuery(internal.recommendations.gatherWatchlistData);

    const attemptInfo = await ctx.runQuery(
      internal.recommendations.getHomepageAttemptInfo,
      { userId: user._id },
    );
    if (
      attemptInfo &&
      Date.now() - attemptInfo.lastAttemptedAt < RATE_LIMIT_MS
    ) {
      return { success: false, error: "rate_limited" };
    }

    const feedbackList = await ctx.runQuery(
      internal.recommendations.getRecommendationFeedbackInternal,
    );

    const likedFeedback = feedbackList
      .filter((f) => f.feedback === "like")
      .map((f) => f.title);

    const dislikedFeedbackTitles = feedbackList
      .filter((f) => f.feedback === "not_interested" || f.feedback === "dislike")
      .map((f) => f.title);

    const dislikedFeedbackIds = feedbackList
      .filter((f) => f.feedback === "not_interested" || f.feedback === "dislike")
      .map((f) => f.tmdbId);

    // Get previous recommendations to prevent repeating recommendations across refresh cycles
    const homepageEntry = await ctx.runQuery(
      internal.recommendations.getHomepageRecommendationEntryInternal,
      { userId: user._id },
    );

    let previousTitles: string[] = [];
    let previousTmdbIds: number[] = [];
    if (homepageEntry?.recommendations) {
      try {
        const prevRecs = JSON.parse(homepageEntry.recommendations) as Recommendation[];
        previousTitles = prevRecs.map((r) => r.title);
        previousTmdbIds = prevRecs
          .map((r) => r.tmdbId)
          .filter((id): id is number => typeof id === "number");
      } catch {
        // ignore parse error
      }
    }

    const systemInstruction =
      "You are a movie and TV show recommendation engine. You analyze a user's watchlist and viewing preferences to suggest titles they would enjoy. You MUST only recommend real, existing movies and TV shows. Never invent fictional titles. Return your response as a JSON object with the exact schema specified by the user.";

    const prompt = buildHomepageRecommendationsPrompt(
      data,
      likedFeedback,
      dislikedFeedbackTitles,
      [...dislikedFeedbackIds, ...previousTmdbIds],
      previousTitles,
    );

    const aiResult = await callGeminiAI(prompt, systemInstruction, 2);
    if (aiResult.error || !aiResult.result) {
      await ctx.runMutation(internal.recommendations.saveHomepageFailure, {
        userId: user._id,
      });
      return { success: false, error: aiResult.error ?? "api_unavailable" };
    }
    const parsed = aiResult.result;

    // Filter out existing watchlist items (double check)
    const existingIds = new Set([
      ...data.watchItems.map((item) => item.tmdbId),
      ...dislikedFeedbackIds,
    ]);
    const existingTitles = new Set(
      data.watchItems.map((item) => normalizeTitleKey(item.title)),
    );

    parsed.recommendations = parsed.recommendations.filter(
      (r) =>
        (r.tmdbId == null || !existingIds.has(r.tmdbId)) &&
        !existingTitles.has(normalizeTitleKey(r.title)),
    );

    await ctx.runMutation(internal.recommendations.saveHomepageRecommendations, {
      userId: user._id,
      recommendations: JSON.stringify(parsed.recommendations),
    });

    return { success: true };
  },
});
