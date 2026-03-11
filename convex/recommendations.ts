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
import { GoogleGenAI } from "@google/genai";

type RecommendationsContext = QueryCtx | MutationCtx;
type RecommendationUser = Doc<"users">;
type RecommendationEntry = Doc<"ai_recommendations">;
type WatchItemSummary = Pick<
  Doc<"watch_items">,
  "tmdbId" | "mediaType" | "title" | "rating" | "progressStatus" | "reaction" | "progress"
>;
type CustomListSummary = Pick<Doc<"lists">, "_id" | "name">;
type CustomListItemSummary = Pick<
  Doc<"list_items">,
  "listId" | "tmdbId" | "mediaType"
>;

function parseIdentityPublicMeta(identity: Record<string, unknown> | null) {
  if (!identity) return null;

  const candidates = [identity["public_meta"], identity["publicMetadata"]];

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

function hasAiGenerationAccess(identity: Record<string, unknown> | null) {
  const meta = parseIdentityPublicMeta(identity);
  return meta?.aiGenerationEnabled === true;
}

function isAiGenerationExplicitlyDisabled(
  identity: Record<string, unknown> | null,
) {
  const meta = parseIdentityPublicMeta(identity);
  return meta?.aiGenerationEnabled === false;
}

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
    const identity = (await ctx.auth.getUserIdentity()) as Record<string, unknown> | null;
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await getUserByTokenIdentifier(ctx, identity.subject as string);
    if (!user) {
      throw new Error("Unauthorized");
    }

    if (!hasAiGenerationAccess(identity)) {
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

export const getUserRecommendationAccess = query({
  args: {},
  handler: async (ctx) => {
    const identity = (await ctx.auth.getUserIdentity()) as Record<string, unknown> | null;
    if (!identity) {
      return { hasAccess: false, reason: "not_authenticated" as const };
    }

    if (!hasAiGenerationAccess(identity)) {
      return { hasAccess: false, reason: "feature_disabled" as const };
    }

    return { hasAccess: true };
  },
});

export const getRecommendationHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = (await ctx.auth.getUserIdentity()) as Record<string, unknown> | null;
    if (!identity || isAiGenerationExplicitlyDisabled(identity)) {
      return [];
    }

    const user = await getUserByTokenIdentifier(ctx, identity.subject as string);
    if (!user) {
      return [];
    }

    const entries = await ctx.db
      .query("ai_recommendations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return entries.sort((a, b) => b.createdAt - a.createdAt);
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

const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];
const RATE_LIMIT_MS = 2 * 60 * 1000;

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

function buildWatchlistPrompt(
  data: WatchlistData,
  mediaTypePreference?: string,
  excludeTmdbIds: number[] = [],
  yearFrom?: number,
  yearTo?: number,
  count?: number,
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
    (i) =>
      i.progressStatus === "done" &&
      i.reaction !== "loved" &&
      i.reaction !== "liked",
  );

  const formatItem = (i: WatchItemSummary) => {
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
  const inScope = (item: WatchItemSummary) => prioritized.has(item.tmdbId);

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

  const mediaLabel =
    mediaTypePreference === "movie"
      ? "movies"
      : mediaTypePreference === "tv"
        ? "TV shows"
        : "movies and TV shows";
  const titleCount = Math.min(Math.max(count ?? 10, 1), 30);
  prompt += `Based on this data, recommend exactly ${titleCount} ${mediaLabel} I would likely enjoy.\n`;
  prompt += `Do NOT recommend any title with these TMDB IDs (already in my watchlist): ${existingIds.join(", ")}\n\n`;

  if (yearFrom || yearTo) {
    const from = yearFrom ?? 1900;
    const to = yearTo ?? new Date().getFullYear();
    prompt += `IMPORTANT: Only recommend titles released between ${from} and ${to} (inclusive).\n\n`;
  }

  prompt += RESPONSE_SCHEMA;

  return prompt;
}

function buildGenrePrompt(
  data: WatchlistData,
  mediaTypePreference?: string,
  genrePreference?: string,
  excludeTmdbIds: number[] = [],
  yearFrom?: number,
  yearTo?: number,
  count?: number,
): string {
  const existingIds = [...data.watchItems.map((i) => i.tmdbId), ...excludeTmdbIds];

  const mediaLabel =
    mediaTypePreference === "movie"
      ? "movies"
      : mediaTypePreference === "tv"
        ? "TV shows"
        : "movies and TV shows";
  const titleCount = Math.min(Math.max(count ?? 10, 1), 30);

  let prompt = `Recommend me exactly ${titleCount} popular and highly-rated ${mediaLabel}`;

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

  if (yearFrom || yearTo) {
    const from = yearFrom ?? 1900;
    const to = yearTo ?? new Date().getFullYear();
    prompt += `IMPORTANT: Only recommend titles released between ${from} and ${to} (inclusive).\n\n`;
  }

  prompt += RESPONSE_SCHEMA;
  return prompt;
}

function buildCustomListPrompt(
  data: WatchlistData,
  listId: string,
  mediaTypePreference?: string,
  excludeTmdbIds: number[] = [],
  yearFrom?: number,
  yearTo?: number,
  count?: number,
): string {
  const existingIds = [...data.watchItems.map((i) => i.tmdbId), ...excludeTmdbIds];

  const mediaLabel =
    mediaTypePreference === "movie"
      ? "movies"
      : mediaTypePreference === "tv"
        ? "TV shows"
        : "movies and TV shows";
  const titleCount = Math.min(Math.max(count ?? 10, 1), 30);

  const list = data.lists.find((l) => l._id === listId);
  const listName = list?.name ?? "this custom list";

  const items = data.listItems.filter((li) => li.listId === listId);
  const titles = items
    .map((li) => {
      const wi = data.watchItems.find(
        (w) => w.tmdbId === li.tmdbId && w.mediaType === li.mediaType,
      );
      return wi?.title
        ? `- ${wi.title} (${li.mediaType})`
        : `- TMDB ID: ${li.tmdbId} (${li.mediaType})`;
    })
    .join("\n");

  let prompt = `Here are the movies and TV shows in my custom list "${listName}":\n\n${titles}\n\n`;
  prompt += `Based on these titles, recommend exactly ${titleCount} ${mediaLabel} I would likely enjoy.\n`;
  prompt += `Find movies/shows that share similar themes, genres, directors, actors, or vibe as the ones in the list.\n\n`;

  if (mediaTypePreference === "movie") {
    prompt += `IMPORTANT: Only recommend MOVIES. Do not suggest any TV shows.\n\n`;
  } else if (mediaTypePreference === "tv") {
    prompt += `IMPORTANT: Only recommend TV SHOWS. Do not suggest any movies.\n\n`;
  }

  if (existingIds.length > 0) {
    prompt += `Do NOT recommend any title with these TMDB IDs (already in my overall watchlist): ${existingIds.join(", ")}\n\n`;
  }

  if (yearFrom || yearTo) {
    const from = yearFrom ?? 1900;
    const to = yearTo ?? new Date().getFullYear();
    prompt += `IMPORTANT: Only recommend titles released between ${from} and ${to} (inclusive).\n\n`;
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
  | {
      recommendations: Recommendation[];
      inputStats: InputStats;
      generatedAt: number;
      cached: boolean;
    }
  | { error: string };

type GeminiErrorLike = {
  status?: number;
  message?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isHighDemandError(error: unknown) {
  const candidate = error as GeminiErrorLike;
  const message = candidate.message?.toLowerCase() ?? "";

  return (
    candidate.status === 503 ||
    message.includes("high demand") ||
    message.includes("503")
  );
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateRecommendationResponse(
  ai: GoogleGenAI,
  userPrompt: string,
  systemInstruction: string,
) {
  let highDemandError = false;

  for (const [index, model] of MODELS_TO_TRY.entries()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction,
        },
      });

      const responseText = response.text ?? "";
      if (responseText) {
        return { responseText, usedModel: model, highDemandError };
      }
    } catch (error) {
      console.error(`Gemini model (${model}) error:`, getErrorMessage(error));
      highDemandError = highDemandError || isHighDemandError(error);

      if (index < MODELS_TO_TRY.length - 1) {
        await delay(1000);
      }
    }
  }

  return { responseText: "", usedModel: MODELS_TO_TRY[0], highDemandError };
}

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
    const excludeTmdbIds = args.excludeTmdbIds ?? [];

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

    const isGenerateMore = excludeTmdbIds.length > 0;
    const mostRecent = await ctx.runQuery(
      internal.recommendations.getMostRecentEntry,
      { userId: user._id },
    );

    if (!isGenerateMore && mostRecent && Date.now() - mostRecent.createdAt < RATE_LIMIT_MS) {
      return { error: "rate_limited" };
    }

    const userPrompt =
      genType === "watchlist"
        ? buildWatchlistPrompt(
            data,
            args.mediaTypePreference,
            excludeTmdbIds,
            args.yearFrom,
            args.yearTo,
            args.count,
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
            )
          : buildGenrePrompt(
              data,
              args.mediaTypePreference,
              args.genrePreference,
              excludeTmdbIds,
              args.yearFrom,
              args.yearTo,
              args.count,
            );

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set in Convex environment variables");
      return { error: "api_unavailable" };
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction =
      "You are a movie and TV show recommendation engine. You analyze a user's watchlist and viewing preferences to suggest titles they would enjoy. You MUST only recommend real, existing movies and TV shows. Never invent fictional titles. Return your response as a JSON object with the exact schema specified by the user.";

    const { responseText, usedModel, highDemandError } =
      await generateRecommendationResponse(ai, userPrompt, systemInstruction);

    if (!responseText) {
      if (highDemandError) {
        return { error: "high_demand" };
      }

      return { error: "api_unavailable" };
    }

    let parsed: { recommendations: Recommendation[] };
    try {
      parsed = JSON.parse(responseText);
      if (!Array.isArray(parsed.recommendations)) {
        return { error: "invalid_response" };
      }
    } catch {
      return { error: "invalid_response" };
    }

    const existingIds = new Set(data.watchItems.map((item) => item.tmdbId));
    parsed.recommendations = parsed.recommendations.filter(
      (r) => r.tmdbId == null || !existingIds.has(r.tmdbId),
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
