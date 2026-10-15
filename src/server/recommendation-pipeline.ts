import { desc, eq, sql } from "drizzle-orm";

import type { Db } from "./db/client";
import type {
  GenerateRecommendationsArgs,
  GenerateResult,
  Recommendation as RecommendationRow,
} from "./schema/recommendations";
import type { MediaType } from "@/domain/media";
import { GENRE_LIST } from "@/constants";
import { captureServerEvent } from "@/lib/posthog-server";
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
import { rerankCandidatesWithJev } from "./recommendation-rerank";

const RATE_LIMIT_MS = 2 * 60 * 1000;
const GENERATION_RATE_LIMIT_KEY = "ai-gen";
const HOMEPAGE_RATE_LIMIT_KEY = "ai-homepage";
const RECENT_HISTORY_EXCLUSION_ENTRIES = 10;
const MAX_RECENT_EXCLUSION_TITLES = 150;
const MAX_HOMEPAGE_RECOMMENDATIONS = 30;
const MAX_HOMEPAGE_PER_MEDIA_TYPE = 15;

// Movie/genre names entered via taste controls resolve to movie-catalog ids
// only, so TV candidates carrying the semantic TV counterpart (e.g.
// "Sci-Fi & Fantasy" for "Science Fiction") were never boosted or demoted.
// Expand each name to its cross-catalog id set (see GENRE_LIST).
const GENRE_ID_EXPANSIONS: Record<number, number[]> = {
  28: [28, 10759], // Action -> Action & Adventure
  12: [12, 10759], // Adventure -> Action & Adventure
  878: [878, 10765], // Science Fiction -> Sci-Fi & Fantasy
  14: [14, 10765], // Fantasy -> Sci-Fi & Fantasy
  10765: [10765, 878, 14], // Sci-Fi & Fantasy -> Science Fiction, Fantasy
  10759: [10759, 28, 12], // Action & Adventure -> Action, Adventure
  10752: [10752, 10768], // War -> War & Politics
  10768: [10768, 10752], // War & Politics -> War
  10762: [10762, 10751, 16], // Kids -> Family, Animation
  10766: [10766, 18], // Soap -> Drama
};

export function genreNamesToIdsExpanded(
  names?: string[],
): number[] | undefined {
  if (!names) return undefined;
  const ids = new Set<number>();
  for (const name of names) {
    const match = GENRE_LIST.find(
      (genre) => genre.name.toLowerCase() === name.toLowerCase(),
    );
    if (!match) continue;
    ids.add(match.id);
    for (const id of GENRE_ID_EXPANSIONS[match.id] ?? []) ids.add(id);
  }
  return [...ids];
}

// Prompt-interpolated titles are untrusted free text; cap the count and
// length before they reach any prompt builder so one noisy signal list cannot
// blow up the prompt. Exclusion sets keep the full values (exact matching).
const MAX_PROMPT_TITLE_CHARS = 80;

export function truncateTitle(title: string): string {
  const clean = title.trim();
  return clean.length > MAX_PROMPT_TITLE_CHARS
    ? `${clean.slice(0, MAX_PROMPT_TITLE_CHARS - 1).trimEnd()}…`
    : clean;
}

function titlesForPrompt(
  titles: string[] | undefined,
  limit: number,
): string[] {
  return (titles ?? []).slice(0, limit).map(truncateTitle);
}

type PipelineContext = {
  db: Db;
  userId: string;
  isAdmin: boolean;
};

export type RecommendationPipelineIntent =
  | { type: "history"; options: GenerateRecommendationsArgs }
  | { type: "homepage" };

/**
 * Cap each media type at 15 and interleave them so neither side starves.
 * The caps are applied to the filtered lists up front: guarding the loop with
 * the *uncapped* lengths made it spin forever once a media type exceeded its
 * cap (e.g. 16 movies and 0 TV shows), hanging the whole generation request.
 * Exported so the termination guarantee is covered by tests.
 */
export function balanceHomepageRecommendations(
  recommendations: RecommendationRow[],
): RecommendationRow[] {
  const movies = recommendations
    .filter((item) => item.mediaType === "movie")
    .slice(0, MAX_HOMEPAGE_PER_MEDIA_TYPE);
  const shows = recommendations
    .filter((item) => item.mediaType === "tv")
    .slice(0, MAX_HOMEPAGE_PER_MEDIA_TYPE);
  const result: RecommendationRow[] = [];
  const total = Math.min(
    MAX_HOMEPAGE_RECOMMENDATIONS,
    movies.length + shows.length,
  );

  for (let index = 0; result.length < total; index++) {
    if (index < movies.length) result.push(movies[index]);
    if (result.length >= total) break;
    if (index < shows.length) result.push(shows[index]);
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
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(aiRecommendations).values({
    id,
    userId,
    recommendations: dedupeRecommendations(recommendations),
    inputStats,
    model,
    mediaTypePreference: options.mediaTypePreference,
    genrePreference: options.genrePreference,
    genreMode: options.genreMode,
    generationType,
    createdAt: Date.now(),
  });
  await bumpAiRev(db, userId);
  return id;
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
  if (generationType === "genre" && !options.genreIds?.length) {
    return { error: "genre_required" };
  }
  if (generationType === "list" && !options.listId) {
    return { error: "listId is required for list generation" };
  }

  const { watchlistData, feedbackSignals, tasteProfile } =
    await gatherGenerationInputs(context.db, context.userId, [
      "not_interested",
    ]);
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
  const likedTitles =
    generationType === "genre"
      ? []
      : [
          ...(feedbackSignals.likedTitles ?? []),
          ...watchlistData.watchItems
            .filter(
              (item) => item.reaction === "loved" || item.reaction === "liked",
            )
            .map((item) => item.title)
            .filter((title): title is string => !!title),
          ...(generationType === "list" && options.listId
            ? watchlistData.listItems
                .filter((item) => item.listId === options.listId)
                .map(
                  (item) =>
                    watchlistData.watchItems.find(
                      (watchItem) =>
                        watchItem.tmdbId === item.tmdbId &&
                        watchItem.mediaType === item.mediaType,
                    )?.title,
                )
                .filter((title): title is string => !!title)
            : []),
        ];
  const dislikedTitles =
    generationType === "genre" ? [] : (feedbackSignals.dislikedTitles ?? []);

  const candidateCatalog = await getRecommendationCandidates({
    watchItems: watchlistData.watchItems,
    excludedWatchItems: watchlistData.excludedWatchItems,
    useWatchlistSeeds: generationType !== "genre",
    genreIds: options.genreIds,
    genreMode: options.genreMode,
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
    preferredGenreIds:
      generationType === "genre"
        ? []
        : genreNamesToIdsExpanded(tasteProfile?.preferredGenres),
    dislikedGenreIds:
      generationType === "genre"
        ? []
        : genreNamesToIdsExpanded(tasteProfile?.dislikedGenres),
    excludeTmdbIds,
    excludeTitles,
    yearFrom: options.yearFrom,
    yearTo: options.yearTo,
    limit: 40,
    balanced: true,
  });
  const reranked = await rerankCandidatesWithJev(candidateCatalog, {
    selectedGenres:
      generationType === "genre"
        ? (options.genrePreference?.split(",").map((genre) => genre.trim()) ??
          [])
        : [],
    likedTitles,
    mediaTypePreference: options.mediaTypePreference,
  });
  await captureServerEvent(context.userId, "recommendation_jev_rerank", {
    generationType,
    ran: reranked.ran,
    candidatesAttempted: reranked.attempted,
    candidatesScored: reranked.scored,
    candidatesFailed: reranked.failed,
    meanConfidence: reranked.meanConfidence,
    durationMs: reranked.durationMs,
    model: "typesafe/jev",
    fallbackReason: reranked.fallbackReason ?? null,
  });
  const orderedCandidates = reranked.candidates;

  const prompt = orderedCandidates.length
    ? buildCandidateRecommendationPrompt({
        candidates: orderedCandidates,
        likedTitles: titlesForPrompt(likedTitles, 20),
        dislikedTitles: titlesForPrompt(dislikedTitles, 30),
        previousTitles: titlesForPrompt(previousTitles, 30),
        mediaTypePreference: options.mediaTypePreference,
        genrePreference: options.genrePreference,
        genreMode: options.genreMode,
        count: Math.min(Math.max(options.count ?? 10, 1), 30),
        // Genre generations are catalog-driven, not personalized: keep taste
        // fields empty here to match the scoring path above.
        dislikedThemes:
          generationType === "genre" ? [] : feedbackSignals.dislikedThemes,
        preferredGenres:
          generationType === "genre" ? [] : tasteProfile?.preferredGenres,
        dislikedGenres:
          generationType === "genre" ? [] : tasteProfile?.dislikedGenres,
        adventureLevel:
          generationType === "genre"
            ? undefined
            : feedbackSignals.adventureLevel,
        goal:
          generationType === "genre"
            ? "Rank the strongest popular, highly-rated matches for the requested genres. Do not personalize from the watchlist."
            : generationType === "list"
              ? "Prefer candidates that match the themes, genres, cast, creators, and tone of the selected custom list."
              : feedbackSignals.adventureLevel === "adventurous"
                ? "Prefer adventurous, high-novelty, or distinctive candidates alongside proven favorites."
                : feedbackSignals.adventureLevel === "familiar"
                  ? "Stick to highly-acclaimed, familiar, well-tested candidates closely matching the user's favorite titles."
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
          {
            ...feedbackSignals,
            likedTitles: titlesForPrompt(feedbackSignals.likedTitles, 20),
            dislikedTitles: titlesForPrompt(feedbackSignals.dislikedTitles, 30),
            previousTitles: titlesForPrompt(previousTitles, 30),
          },
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
            {
              ...feedbackSignals,
              likedTitles: titlesForPrompt(feedbackSignals.likedTitles, 20),
              dislikedTitles: titlesForPrompt(
                feedbackSignals.dislikedTitles,
                30,
              ),
              previousTitles: titlesForPrompt(previousTitles, 30),
            },
          )
        : buildGenrePrompt(
            watchlistData,
            options.mediaTypePreference,
            options.genrePreference,
            excludeTmdbIds,
            options.yearFrom,
            options.yearTo,
            options.count,
            options.genreMode,
          );

  const targetCount = Math.min(Math.max(options.count ?? 10, 1), 30);
  const generated = await runAiGeneration({
    distinctId: context.userId,
    prompt,
    attempts: 2,
    targetCount,
    watchItems: watchlistData.watchItems,
    excludedWatchItems: watchlistData.excludedWatchItems,
    excludeTmdbIds,
    excludeTitles,
    candidateCatalog: orderedCandidates.length ? orderedCandidates : undefined,
  });
  if (!generated.ok) {
    if (token.token) await releaseRateLimit(context.db, token.token);
    return { error: generated.error };
  }

  const generationId = await saveRecommendations(
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
    generationId,
  };
}

async function runHomepagePipeline(
  context: PipelineContext,
): Promise<GenerateResult> {
  const [homepageEntry] = await context.db
    .select()
    .from(homepageRecommendations)
    .where(eq(homepageRecommendations.userId, context.userId))
    .limit(1);

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const isGeneratedInLast24Hours =
    homepageEntry?.status === "success" &&
    (homepageEntry?.lastUpdatedAt ?? 0) > 0 &&
    Date.now() - (homepageEntry?.lastUpdatedAt ?? 0) < ONE_DAY_MS;

  if (isGeneratedInLast24Hours) {
    const existingRecs = parseStoredRecommendations(
      homepageEntry.recommendations,
    );
    if (existingRecs && existingRecs.length > 0) {
      return {
        recommendations: existingRecs,
        inputStats: {
          movieCount: existingRecs.filter((r) => r.mediaType === "movie")
            .length,
          tvCount: existingRecs.filter((r) => r.mediaType === "tv").length,
          episodesWatched: 0,
          totalItems: existingRecs.length,
        },
        cached: true,
        generatedAt: homepageEntry.lastUpdatedAt ?? Date.now(),
      };
    }
  }

  const token = await consumeGenerationToken(
    context.db,
    context.userId,
    context.isAdmin,
    HOMEPAGE_RATE_LIMIT_KEY,
  );
  if (token.error) return { error: token.error };

  const { watchlistData, feedbackSignals, tasteProfile } =
    await gatherGenerationInputs(context.db, context.userId, [
      "not_interested",
      "dislike",
    ]);
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
    excludedWatchItems: watchlistData.excludedWatchItems,
    excludeTmdbIds: excludeIds,
    excludeTitles,
    preferredGenreIds: genreNamesToIdsExpanded(tasteProfile?.preferredGenres),
    dislikedGenreIds: genreNamesToIdsExpanded(tasteProfile?.dislikedGenres),
    limit: 60,
    balanced: true,
  });
  const reranked = await rerankCandidatesWithJev(candidateCatalog, {
    likedTitles: feedbackSignals.likedTitles ?? [],
    mediaTypePreference: undefined,
  });
  await captureServerEvent(context.userId, "recommendation_jev_rerank", {
    generationType: "homepage",
    ran: reranked.ran,
    candidatesAttempted: reranked.attempted,
    candidatesScored: reranked.scored,
    candidatesFailed: reranked.failed,
    meanConfidence: reranked.meanConfidence,
    durationMs: reranked.durationMs,
    model: "typesafe/jev",
    fallbackReason: reranked.fallbackReason ?? null,
  });
  const orderedCandidates = reranked.candidates;
  const prompt = orderedCandidates.length
    ? buildCandidateRecommendationPrompt({
        candidates: orderedCandidates,
        likedTitles: titlesForPrompt(feedbackSignals.likedTitles, 20),
        dislikedTitles: titlesForPrompt(feedbackSignals.dislikedTitles, 30),
        previousTitles: titlesForPrompt(previousTitles, 30),
        count: 30,
        dislikedThemes: feedbackSignals.dislikedThemes,
        preferredGenres: tasteProfile?.preferredGenres,
        dislikedGenres: tasteProfile?.dislikedGenres,
        adventureLevel: feedbackSignals.adventureLevel,
        goal:
          feedbackSignals.adventureLevel === "adventurous"
            ? "Choose an adventurous homepage mix with the strongest 15 movie and 15 TV matches, balancing hits with bold discoveries."
            : feedbackSignals.adventureLevel === "familiar"
              ? "Choose a familiar homepage mix with the strongest 15 movie and 15 TV matches, focusing on proven acclaimed hits."
              : "Choose a balanced homepage mix with the strongest 15 movie and 15 TV matches when enough candidates exist.",
      })
    : buildHomepageRecommendationsPrompt(
        watchlistData,
        titlesForPrompt(feedbackSignals.likedTitles, 20),
        titlesForPrompt(feedbackSignals.dislikedTitles, 30),
        excludeIds,
        titlesForPrompt(previousTitles, 30),
      );

  const generated = await runAiGeneration({
    distinctId: context.userId,
    prompt,
    attempts: 2,
    targetCount: 30,
    watchItems: watchlistData.watchItems,
    excludedWatchItems: watchlistData.excludedWatchItems,
    excludeTmdbIds: excludeIds,
    excludeTitles,
    candidateCatalog: orderedCandidates.length ? orderedCandidates : undefined,
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
