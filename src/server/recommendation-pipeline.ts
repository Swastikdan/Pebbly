import { desc, eq, sql } from "drizzle-orm";

import type { Db } from "./db/client";
import type { Recommendation as RecommendationRow } from "./db/schema";
import type {
  GenerateRecommendationsArgs,
  GenerateResult,
} from "./schema/recommendations";
import type { MediaType } from "@/domain/media";
import { dedupeRecommendations } from "./ai";
import { aiRecommendations, homepageRecommendations } from "./db/schema";
import { releaseRateLimit, tryConsumeRateLimit } from "./helpers/rate-limit";
import { bumpAiRev } from "./helpers/watch-item";
import {
  buildCandidateRecommendationPrompt,
  buildCustomListPrompt,
  buildGenrePrompt,
  buildHomepageRecommendationsPrompt,
  buildWatchlistPrompt,
} from "./prompts";
import { getRecommendationCandidates } from "./recommendation-candidates";
import {
  gatherGenerationInputs,
  parseStoredRecommendations,
  runAiGeneration,
} from "./recommendation-generation";

const RATE_LIMIT_MS = 2 * 60 * 1000;
const GENERATION_RATE_LIMIT_KEY = "ai-gen";
const HOMEPAGE_RATE_LIMIT_KEY = "ai-homepage";
const RECENT_HISTORY_EXCLUSION_ENTRIES = 10;
const MAX_RECENT_EXCLUSION_TITLES = 150;

type PipelineContext = {
  db: Db;
  userId: string;
  isAdmin: boolean;
};

export type RecommendationPipelineIntent =
  | { type: "history"; options: GenerateRecommendationsArgs }
  | { type: "homepage" };

function balanceHomepageRecommendations(
  recommendations: RecommendationRow[],
): RecommendationRow[] {
  const movies = recommendations.filter((item) => item.mediaType === "movie");
  const shows = recommendations.filter((item) => item.mediaType === "tv");
  const result: RecommendationRow[] = [];
  let movieIndex = 0;
  let showIndex = 0;

  while (
    result.length < 30 &&
    (movieIndex < movies.length || showIndex < shows.length)
  ) {
    if (movieIndex < Math.min(movies.length, 15))
      result.push(movies[movieIndex++]);
    if (result.length >= 30) break;
    if (showIndex < Math.min(shows.length, 15)) result.push(shows[showIndex++]);
  }

  return result;
}

async function getRecentRecommendationExclusions(
  db: Db,
  userId: string,
): Promise<{ tmdbIds: number[]; titles: string[] }> {
  const rows = await db
    .select({ recommendations: aiRecommendations.recommendations })
    .from(aiRecommendations)
    .where(eq(aiRecommendations.userId, userId))
    .orderBy(desc(aiRecommendations.createdAt))
    .limit(RECENT_HISTORY_EXCLUSION_ENTRIES);

  const recommendations = rows.flatMap(
    (row) => parseStoredRecommendations(row.recommendations) ?? [],
  );
  return {
    tmdbIds: [
      ...new Set(
        recommendations
          .map((recommendation) => recommendation.tmdbId)
          .filter((id): id is number => typeof id === "number"),
      ),
    ],
    titles: [
      ...new Set(
        recommendations
          .map((recommendation) => recommendation.title)
          .filter((title): title is string => !!title),
      ),
    ].slice(0, MAX_RECENT_EXCLUSION_TITLES),
  };
}

async function saveRecommendations(
  db: Db,
  userId: string,
  recommendations: RecommendationRow[],
  inputStats: {
    movieCount: number;
    tvCount: number;
    episodesWatched: number;
    totalItems: number;
  },
  options: GenerateRecommendationsArgs,
  generationType: string,
  model: string,
) {
  await db.insert(aiRecommendations).values({
    id: crypto.randomUUID(),
    userId,
    recommendations: dedupeRecommendations(recommendations),
    inputStats,
    model,
    mediaTypePreference: options.mediaTypePreference,
    genrePreference: options.genrePreference,
    generationType,
    createdAt: Date.now(),
  });
  await bumpAiRev(db, userId);
}

async function saveHomepage(
  db: Db,
  userId: string,
  recommendations: RecommendationRow[],
) {
  const now = Date.now();
  await db
    .insert(homepageRecommendations)
    .values({
      id: crypto.randomUUID(),
      userId,
      recommendations: dedupeRecommendations(recommendations),
      lastAttemptedAt: now,
      lastUpdatedAt: now,
      status: "success",
    })
    .onConflictDoUpdate({
      target: homepageRecommendations.userId,
      set: {
        previousRecommendations: sql`${homepageRecommendations.recommendations}`,
        recommendations: dedupeRecommendations(recommendations),
        lastAttemptedAt: now,
        lastUpdatedAt: now,
        status: "success",
      },
    });
  await bumpAiRev(db, userId);
}

async function saveHomepageFailure(db: Db, userId: string) {
  const now = Date.now();
  await db
    .insert(homepageRecommendations)
    .values({
      id: crypto.randomUUID(),
      userId,
      recommendations: [],
      lastAttemptedAt: now,
      lastUpdatedAt: 0,
      status: "failed",
    })
    .onConflictDoUpdate({
      target: homepageRecommendations.userId,
      set: { lastAttemptedAt: now, lastUpdatedAt: 0, status: "failed" },
    });
  await bumpAiRev(db, userId);
}

async function consumeGenerationToken(
  db: Db,
  userId: string,
  isAdmin: boolean,
  key: string,
): Promise<{ token?: string; error?: "rate_limited" }> {
  if (isAdmin) return {};
  const result = await tryConsumeRateLimit(
    db,
    `${key}:${userId}`,
    RATE_LIMIT_MS,
  );
  return result.allowed ? { token: result.token } : { error: "rate_limited" };
}

async function runHistoryPipeline(
  context: PipelineContext,
  options: GenerateRecommendationsArgs,
): Promise<GenerateResult> {
  const generationType = options.generationType ?? "watchlist";
  if (generationType === "list" && !options.listId) {
    return { error: "listId is required for list generation" };
  }

  const { watchlistData, feedbackSignals } = await gatherGenerationInputs(
    context.db,
    context.userId,
    ["not_interested"],
  );
  if (generationType === "watchlist" && watchlistData.watchItems.length === 0) {
    return { error: "empty_watchlist" };
  }
  if (
    generationType === "list" &&
    options.listId &&
    watchlistData.listItems.filter((item) => item.listId === options.listId)
      .length === 0
  ) {
    return { error: "empty_watchlist" };
  }

  const token = await consumeGenerationToken(
    context.db,
    context.userId,
    context.isAdmin,
    GENERATION_RATE_LIMIT_KEY,
  );
  if (token.error) return { error: token.error };

  const recent = await getRecentRecommendationExclusions(
    context.db,
    context.userId,
  );
  const excludeTmdbIds = [
    ...new Set([
      ...(options.excludeTmdbIds ?? []),
      ...(feedbackSignals.dislikedTmdbIds ?? []),
      ...recent.tmdbIds,
    ]),
  ];
  const excludeTitles = [
    ...new Set([...(feedbackSignals.dislikedTitles ?? []), ...recent.titles]),
  ];
  const previousTitles = [
    ...(feedbackSignals.previousTitles ?? []),
    ...recent.titles,
  ];

  const candidateCatalog = await getRecommendationCandidates({
    watchItems: watchlistData.watchItems,
    seedItems:
      generationType === "list" && options.listId
        ? watchlistData.listItems
            .filter((item) => item.listId === options.listId)
            .map((item) =>
              item.mediaType === "movie" || item.mediaType === "tv"
                ? { tmdbId: item.tmdbId, mediaType: item.mediaType }
                : null,
            )
            .filter(
              (item): item is { tmdbId: number; mediaType: MediaType } =>
                item !== null,
            )
        : undefined,
    mediaTypePreference: options.mediaTypePreference,
    excludeTmdbIds,
    excludeTitles,
    yearFrom: options.yearFrom,
    yearTo: options.yearTo,
    limit: 40,
    balanced: true,
  });
  const likedTitles = [
    ...(feedbackSignals.likedTitles ?? []),
    ...watchlistData.watchItems
      .filter((item) => item.reaction === "loved" || item.reaction === "liked")
      .map((item) => item.title)
      .filter((title): title is string => !!title),
  ];

  const prompt = candidateCatalog.length
    ? buildCandidateRecommendationPrompt({
        candidates: candidateCatalog,
        likedTitles,
        dislikedTitles: feedbackSignals.dislikedTitles ?? [],
        previousTitles,
        mediaTypePreference: options.mediaTypePreference,
        genrePreference: options.genrePreference,
        count: Math.min(Math.max(options.count ?? 10, 1), 30),
        goal:
          generationType === "list"
            ? "Prefer candidates that match the themes, genres, cast, creators, and tone of the selected custom list."
            : "Prefer candidates that match the user's strongest positive viewing signals while keeping the results varied.",
      })
    : generationType === "watchlist"
      ? buildWatchlistPrompt(
          watchlistData,
          options.mediaTypePreference,
          excludeTmdbIds,
          options.yearFrom,
          options.yearTo,
          options.count,
          { ...feedbackSignals, previousTitles },
        )
      : generationType === "list" && options.listId
        ? buildCustomListPrompt(
            watchlistData,
            options.listId,
            options.mediaTypePreference,
            excludeTmdbIds,
            options.yearFrom,
            options.yearTo,
            options.count,
            { ...feedbackSignals, previousTitles },
          )
        : buildGenrePrompt(
            watchlistData,
            options.mediaTypePreference,
            options.genrePreference,
            excludeTmdbIds,
            options.yearFrom,
            options.yearTo,
            options.count,
            { ...feedbackSignals, previousTitles },
          );

  const generated = await runAiGeneration({
    prompt,
    attempts: 1,
    watchItems: watchlistData.watchItems,
    excludeTmdbIds,
    excludeTitles,
    candidateCatalog: candidateCatalog.length ? candidateCatalog : undefined,
  });
  if (!generated.ok) {
    if (token.token) await releaseRateLimit(context.db, token.token);
    return { error: generated.error };
  }

  await saveRecommendations(
    context.db,
    context.userId,
    generated.recommendations,
    watchlistData.inputStats,
    options,
    generationType,
    generated.usedModel,
  );
  return {
    recommendations: generated.recommendations,
    inputStats: watchlistData.inputStats,
    generatedAt: Date.now(),
    cached: false,
  };
}

async function runHomepagePipeline(
  context: PipelineContext,
): Promise<GenerateResult> {
  const token = await consumeGenerationToken(
    context.db,
    context.userId,
    context.isAdmin,
    HOMEPAGE_RATE_LIMIT_KEY,
  );
  if (token.error) return { error: token.error };

  const { watchlistData, feedbackSignals } = await gatherGenerationInputs(
    context.db,
    context.userId,
    ["not_interested", "dislike"],
  );
  const [homepageEntry] = await context.db
    .select()
    .from(homepageRecommendations)
    .where(eq(homepageRecommendations.userId, context.userId))
    .limit(1);
  const previous = parseStoredRecommendations(homepageEntry?.recommendations);
  const recent = await getRecentRecommendationExclusions(
    context.db,
    context.userId,
  );
  const previousTitles = [
    ...(previous?.map((item) => item.title) ?? []),
    ...recent.titles,
  ];
  const excludeIds = [
    ...new Set([
      ...(feedbackSignals.dislikedTmdbIds ?? []),
      ...(previous
        ?.flatMap((item) => item.tmdbId ?? [])
        .filter((id): id is number => typeof id === "number") ?? []),
      ...recent.tmdbIds,
    ]),
  ];
  const excludeTitles = [
    ...new Set([...(feedbackSignals.dislikedTitles ?? []), ...previousTitles]),
  ];
  const candidateCatalog = await getRecommendationCandidates({
    watchItems: watchlistData.watchItems,
    excludeTmdbIds: excludeIds,
    excludeTitles,
    limit: 60,
    balanced: true,
  });
  const prompt = candidateCatalog.length
    ? buildCandidateRecommendationPrompt({
        candidates: candidateCatalog,
        likedTitles: feedbackSignals.likedTitles ?? [],
        dislikedTitles: feedbackSignals.dislikedTitles ?? [],
        previousTitles,
        count: 30,
        goal: "Choose a balanced homepage mix with the strongest 15 movie and 15 TV matches when enough candidates exist.",
      })
    : buildHomepageRecommendationsPrompt(
        watchlistData,
        feedbackSignals.likedTitles ?? [],
        feedbackSignals.dislikedTitles ?? [],
        excludeIds,
        previousTitles,
      );

  const generated = await runAiGeneration({
    prompt,
    attempts: 2,
    watchItems: watchlistData.watchItems,
    excludeTmdbIds: excludeIds,
    excludeTitles,
    candidateCatalog: candidateCatalog.length ? candidateCatalog : undefined,
  });
  if (!generated.ok) {
    if (token.token) await releaseRateLimit(context.db, token.token);
    await saveHomepageFailure(context.db, context.userId);
    return { error: generated.error };
  }

  const recommendations = balanceHomepageRecommendations(
    generated.recommendations,
  );
  if (recommendations.length === 0) {
    await saveHomepageFailure(context.db, context.userId);
    return { error: "empty_result" };
  }
  await saveHomepage(context.db, context.userId, recommendations);
  return {
    recommendations,
    inputStats: watchlistData.inputStats,
    generatedAt: Date.now(),
    cached: false,
  };
}

export function runPipeline(
  context: PipelineContext,
  intent: RecommendationPipelineIntent,
): Promise<GenerateResult> {
  return intent.type === "homepage"
    ? runHomepagePipeline(context)
    : runHistoryPipeline(context, intent.options);
}
