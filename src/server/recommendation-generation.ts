import { desc, eq } from "drizzle-orm";

import type { Recommendation } from "./ai";
import type { Db } from "./db/client";
import type { FeedbackSignals, WatchlistData } from "./prompts";
import { normalizeTitleKey } from "@/lib/text";
import { callGeminiAI, MODELS_TO_TRY } from "./ai";
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
 * Load everything a generation prompt needs in one shot: the user's viewing
 * data plus their like/dislike feedback folded into prompt-ready signal
 * lists. `dislikeKinds` selects which feedback values count as dislikes
 * ("not_interested" for history generations, plus "dislike" for homepage).
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
  | { ok: true; recommendations: Recommendation[]; usedModel: string }
  | { ok: false; error: string };

/**
 * Call Gemini and filter out titles the user already knows (on their
 * watchlist or excluded). Returns the surviving recommendations; callers
 * own rate limiting before the call and result persistence after.
 */
export async function runAiGeneration(args: {
  prompt: string;
  attempts: number;
  watchItems: WatchlistData["watchItems"];
  excludeTmdbIds: number[];
}): Promise<AiGenerationResult> {
  const aiResult = await callGeminiAI(
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
