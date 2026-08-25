import { desc, eq } from "drizzle-orm";

import type { Recommendation } from "./ai";
import type { Db } from "./db/client";
import type { FeedbackSignals, WatchlistData } from "./prompts";
import { normalizeTitleKey } from "@/lib/text";
import { callOpenRouterAI, MODELS_TO_TRY } from "./ai";
import {
  episodeProgress,
  listItems,
  lists,
  recommendationFeedback,
  watchItems,
} from "./db/schema";

const SYSTEM_INSTRUCTION =
  "You are a movie and TV show recommendation engine. You analyze a user's watchlist and viewing preferences to suggest titles they would enjoy. You MUST only recommend real, existing movies and TV shows. Never invent fictional titles. Return your response as a JSON object with the exact schema specified by the user.";

export type GenerationInputs = {
  watchlistData: WatchlistData;
  feedbackSignals: FeedbackSignals;
};

/**
 * Loads watchlist data and feedback signals for recommendation generation.
 *
 * @param dislikeKinds - Feedback values treated as dislikes when building the signals
 * @returns The user's watchlist data and prompt-ready feedback signals
 */
export async function gatherGenerationInputs(
  db: Db,
  userId: string,
  dislikeKinds: string[],
): Promise<GenerationInputs> {
  const [watchlistData, feedbackList] = await Promise.all([
    gatherWatchlistData(db, userId),
    getRecommendationFeedbackInternal(db, userId),
  ]);

  return {
    watchlistData,
    feedbackSignals: {
      likedTitles: collectFeedback(feedbackList, ["like"], "title"),
      dislikedTitles: collectFeedback(feedbackList, dislikeKinds, "title"),
      dislikedTmdbIds: collectFeedback(feedbackList, dislikeKinds, "tmdbId"),
    },
  };
}

export type AiGenerationResult =
  | {
      ok: true;
      recommendations: Recommendation[];
      usedModel: string;
      reasoningTokens?: number;
    }
  | { ok: false; error: string };

/**
 * Generates recommendations and removes titles already present in the user's known or excluded content.
 *
 * @param prompt - The recommendation-generation prompt
 * @param attempts - The maximum number of generation attempts
 * @param watchItems - The user's existing watchlist items
 * @param excludeTmdbIds - TMDB IDs to exclude from the recommendations
 * @returns A successful result containing filtered recommendations and model metadata, or an error result
 */
export async function runAiGeneration(args: {
  prompt: string;
  attempts: number;
  watchItems: WatchlistData["watchItems"];
  excludeTmdbIds: number[];
}): Promise<AiGenerationResult> {
  const aiResult = await callOpenRouterAI(
    args.prompt,
    SYSTEM_INSTRUCTION,
    args.attempts,
  );
  if (aiResult.error || !aiResult.result) {
    return { ok: false, error: aiResult.error ?? "api_unavailable" };
  }

  return {
    ok: true,
    usedModel: aiResult.usedModel ?? MODELS_TO_TRY[0],
    reasoningTokens: aiResult.reasoningTokens,
    recommendations: filterKnownRecommendations(
      aiResult.result.recommendations,
      args.watchItems,
      args.excludeTmdbIds,
    ),
  };
}

/**
 * Stored recommendation columns are json-mode text typed Recommendation[],
 * but older rows may hold stringified JSON; accept either shape. Logs and
 * returns null when neither parses.
 */
export function parseStoredRecommendations(
  raw: unknown,
): Recommendation[] | null {
  if (!raw) return null;
  try {
    const parsed = Array.isArray(raw)
      ? raw
      : (JSON.parse(String(raw)) as unknown);
    return Array.isArray(parsed) ? (parsed as Recommendation[]) : null;
  } catch (e) {
    console.error("Failed to parse stored recommendations", e);
    return null;
  }
}

function collectFeedback<K extends "title" | "tmdbId">(
  list: Array<typeof recommendationFeedback.$inferSelect>,
  feedback: string[],
  key: K,
): Array<(typeof recommendationFeedback.$inferSelect)[K]> {
  return list.filter((f) => feedback.includes(f.feedback)).map((f) => f[key]);
}

function filterKnownRecommendations<
  T extends { tmdbId?: number | null; title?: string | null },
>(
  recommendations: T[],
  watchItems: Array<{ tmdbId: number; title: string | null }>,
  extraExcludedIds: number[],
): T[] {
  const existingIds = new Set([
    ...watchItems.map((item) => item.tmdbId),
    ...extraExcludedIds,
  ]);
  const existingTitles = new Set(
    watchItems.map((item) => normalizeTitleKey(item.title)),
  );
  return recommendations.filter(
    (r) =>
      (r.tmdbId == null || !existingIds.has(r.tmdbId)) &&
      !existingTitles.has(normalizeTitleKey(r.title)),
  );
}

async function getRecommendationFeedbackInternal(db: Db, userId: string) {
  return db
    .select()
    .from(recommendationFeedback)
    .where(eq(recommendationFeedback.userId, userId))
    .limit(100);
}

async function gatherWatchlistData(
  db: Db,
  userId: string,
): Promise<WatchlistData> {
  const [watchItemRows, listRows, listItemRows, episodeRows] = await db.batch([
    db
      .select({
        tmdbId: watchItems.tmdbId,
        mediaType: watchItems.mediaType,
        title: watchItems.title,
        rating: watchItems.rating,
        progressStatus: watchItems.progressStatus,
        reaction: watchItems.reaction,
        progress: watchItems.progress,
      })
      .from(watchItems)
      .where(eq(watchItems.userId, userId))
      .orderBy(desc(watchItems.updatedAt))
      .limit(200),
    db
      .select({
        id: lists.id,
        name: lists.name,
      })
      .from(lists)
      .where(eq(lists.userId, userId))
      .limit(50),
    db
      .select({
        listId: listItems.listId,
        tmdbId: listItems.tmdbId,
        mediaType: listItems.mediaType,
      })
      .from(listItems)
      .where(eq(listItems.userId, userId))
      .orderBy(desc(listItems.addedAt))
      .limit(200),
    db
      .select({
        isWatched: episodeProgress.isWatched,
      })
      .from(episodeProgress)
      .where(eq(episodeProgress.userId, userId))
      .orderBy(desc(episodeProgress.updatedAt))
      .limit(200),
  ]);

  const watchedEpisodes = episodeRows.filter((e) => e.isWatched).length;
  const movieCount = watchItemRows.filter(
    (i) => i.mediaType === "movie",
  ).length;
  const tvCount = watchItemRows.filter((i) => i.mediaType === "tv").length;

  return {
    watchItems: watchItemRows.map((i) => ({
      tmdbId: i.tmdbId,
      mediaType: i.mediaType,
      title: i.title,
      rating: i.rating,
      progressStatus: i.progressStatus,
      reaction: i.reaction,
      progress: i.progress,
    })),
    lists: listRows.map((l) => ({ _id: l.id, name: l.name })),
    listItems: listItemRows.map((li) => ({
      listId: li.listId,
      tmdbId: li.tmdbId,
      mediaType: li.mediaType,
    })),
    inputStats: {
      movieCount,
      tvCount,
      episodesWatched: watchedEpisodes,
      totalItems: watchItemRows.length,
    },
  };
}
