import { useUser } from "@clerk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { MediaType } from "@/lib/media-types";
import type { AIRecommendation } from "@/types";
import { ERA_PRESETS } from "@/components/recommendations/recommendation-filters";
import { queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import { normalizeTitleKey } from "@/lib/text";
import { logError as logRecommendationError } from "@/lib/utils";
import {
  deleteRecommendation,
  getGenerationStatus,
  getRecommendationHistory,
  startGeneration,
  updateVerifiedRecommendations,
} from "@/server/fns/recommendations";
import { unwrap } from "@/server/schema/common";
import { MAX_EXCLUDE_TMDB_IDS } from "@/server/schema/recommendations";

export interface GenerateOptions {
  generationType?: "watchlist" | "list" | "genre";
  listId?: string;
  mediaTypePreference?: MediaType;
  genrePreference?: string;
  excludeTmdbIds?: number[];
  yearFrom?: number;
  yearTo?: number;
  count?: number;
}

export interface RecommendationHistoryEntry {
  id: string;
  recommendations: AIRecommendation[];
  inputStats: {
    movieCount: number;
    tvCount: number;
    episodesWatched: number;
    totalItems: number;
  };
  createdAt: number;
  generationType?: string;
  mediaTypePreference?: string;
  genrePreference?: string;
  verified?: boolean;
}

export interface TrackedContentSets {
  trackedTmdbIds: Set<number>;
  trackedTitles: Set<string>;
}

// Poll-loop safety rails. The server self-heals stale jobs after
// JOB_STALE_MS (5 min), and a normal generation completes in well under a
// minute, so 6 minutes here is generous; past it the UI shows an error
// instead of spinning forever.
const MAX_JOB_POLL_MS = 6 * 60 * 1000;
const MAX_JOB_POLL_FAILURES = 5;

export function isTrackedRecommendation(
  recommendation: AIRecommendation,
  tracked: TrackedContentSets,
): boolean {
  const candidateIds = [
    recommendation.tmdbId,
    recommendation.verifiedTmdbId,
  ].filter((id): id is number => typeof id === "number");
  if (candidateIds.some((id) => tracked.trackedTmdbIds.has(id))) return true;

  const candidateTitles = [
    recommendation.title,
    recommendation.verifiedTitle,
  ].map(normalizeTitleKey);

  return candidateTitles.some(
    (title) => title && tracked.trackedTitles.has(title),
  );
}

export function selectUntrackedHistory(
  history: RecommendationHistoryEntry[],
  tracked: TrackedContentSets,
  filteringEnabled: boolean,
): RecommendationHistoryEntry[] {
  if (!filteringEnabled) return history;
  return history
    .map((entry) => ({
      ...entry,
      recommendations: entry.recommendations.filter(
        (r) => !isTrackedRecommendation(r, tracked),
      ),
    }))
    .filter((entry) => entry.recommendations.length > 0);
}

function cappedTrackedExclusions(
  trackedTmdbIds: Set<number>,
): number[] | undefined {
  if (trackedTmdbIds.size === 0) return undefined;
  return Array.from(trackedTmdbIds).slice(0, MAX_EXCLUDE_TMDB_IDS);
}

export interface FreshGenerateOptionsInput {
  generationType: "watchlist" | "genre" | "list";
  listId?: string;
  mediaTypePreference?: MediaType;
  selectedGenres?: string[];
  selectedEras?: string[];
  count: number;
}

export function buildGenerateOptions(
  input: FreshGenerateOptionsInput,
  trackedTmdbIds: Set<number>,
): GenerateOptions {
  const options: GenerateOptions = { generationType: input.generationType };
  if (input.generationType === "list") options.listId = input.listId;

  if (input.mediaTypePreference)
    options.mediaTypePreference = input.mediaTypePreference;
  if (input.generationType === "genre" && input.selectedGenres?.length)
    options.genrePreference = input.selectedGenres.join(", ");

  if (input.selectedEras && input.selectedEras.length > 0) {
    const matchedEras = ERA_PRESETS.filter((e) =>
      input.selectedEras?.includes(e.label),
    );
    options.yearFrom = Math.min(...matchedEras.map((e) => e.from));
    options.yearTo = Math.max(...matchedEras.map((e) => e.to));
  }

  const exclusions = cappedTrackedExclusions(trackedTmdbIds);
  if (exclusions) options.excludeTmdbIds = exclusions;

  options.count = input.count;
  return options;
}

export interface RepeatGenerateContext {
  count: number;
  trackedTmdbIds: Set<number>;
}

function buildRepeatBaseOptions(
  entry: RecommendationHistoryEntry,
  { count, trackedTmdbIds }: RepeatGenerateContext,
): GenerateOptions {
  const options: GenerateOptions = {
    generationType: (entry.generationType || "watchlist") as
      "watchlist" | "list" | "genre",
  };
  if (entry.mediaTypePreference)
    options.mediaTypePreference = entry.mediaTypePreference as MediaType;
  if (entry.genrePreference) options.genrePreference = entry.genrePreference;

  const exclusions = cappedTrackedExclusions(trackedTmdbIds);
  if (exclusions) options.excludeTmdbIds = exclusions;

  options.count = count;
  return options;
}

export function buildGenerateAgainOptions(
  entry: RecommendationHistoryEntry,
  context: RepeatGenerateContext,
): GenerateOptions {
  return buildRepeatBaseOptions(entry, context);
}

export function buildGenerateMoreOptions(
  entry: RecommendationHistoryEntry,
  { count, trackedTmdbIds }: RepeatGenerateContext,
): GenerateOptions {
  const options = buildRepeatBaseOptions(entry, { count, trackedTmdbIds });

  options.excludeTmdbIds = [
    ...new Set([
      ...entry.recommendations
        .flatMap((r) => [r.tmdbId, r.verifiedTmdbId])
        .filter((id): id is number => typeof id === "number"),
      ...Array.from(trackedTmdbIds),
    ]),
  ].slice(0, MAX_EXCLUDE_TMDB_IDS);

  return options;
}

export function useRecommendations() {
  const { isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const historyQuery = useQuery({
    queryKey: queryKeys.recommendations.history(user?.id),
    queryFn: () => unwrap(getRecommendationHistory()),
    enabled: !!isSignedIn,
  });
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(
    new Set(),
  );
  const jobStartedAtRef = useRef(0);
  const jobTimeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearJobTimeoutTimer = useCallback(() => {
    if (jobTimeoutTimerRef.current) {
      clearTimeout(jobTimeoutTimerRef.current);
      jobTimeoutTimerRef.current = null;
    }
  }, []);

  // Poll for active job status
  const jobQuery = useQuery({
    queryKey: queryKeys.recommendations.job(activeJobId),
    queryFn: () =>
      unwrap(getGenerationStatus({ data: { jobId: activeJobId! } })),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      // Hard client-side rails so the spinner can never stick forever even
      // if every request fails or the server never reaches a terminal state.
      if (query.state.fetchFailureCount >= MAX_JOB_POLL_FAILURES) return false;
      if (Date.now() - jobStartedAtRef.current > MAX_JOB_POLL_MS) return false;
      return 3000;
    },
    enabled: !!activeJobId,
  });

  // React to job completion / failure
  useEffect(() => {
    if (!activeJobId) return;
    const status = jobQuery.data?.status;
    if (status === "completed") {
      clearJobTimeoutTimer();
      recordOwnMutation("ai");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations.history(user?.id),
      });
      setActiveJobId(null);
    } else if (status === "failed" && jobQuery.data) {
      clearJobTimeoutTimer();
      setError(
        "error" in jobQuery.data ? jobQuery.data.error : "Generation failed",
      );
      setActiveJobId(null);
    } else if (jobQuery.isError) {
      clearJobTimeoutTimer();
      setError("generation_status_unavailable");
      setActiveJobId(null);
    }
  }, [
    activeJobId,
    jobQuery.data,
    jobQuery.isError,
    clearJobTimeoutTimer,
    queryClient,
    user?.id,
  ]);

  const isGenerating = activeJobId !== null;

  const history: RecommendationHistoryEntry[] = useMemo(
    () =>
      (historyQuery.data ?? [])
        .filter((entry) => !optimisticDeletedIds.has(entry.id))
        .map((entry) => ({
          id: entry.id,
          recommendations: entry.recommendations ?? [],
          inputStats: entry.inputStats,
          createdAt: entry.createdAt,
          generationType: entry.generationType ?? "watchlist",
          mediaTypePreference: entry.mediaTypePreference ?? undefined,
          genrePreference: entry.genrePreference ?? undefined,
          verified: entry.verified ?? false,
        })),
    [historyQuery.data, optimisticDeletedIds],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => unwrap(deleteRecommendation({ data: { id } })),
    onSuccess: () => recordOwnMutation("ai"),
    onError: (err, id) => {
      logRecommendationError("delete recommendation", err);
      setOptimisticDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations.history(user?.id),
      });
    },
  });

  const generate = useCallback(
    async (options?: GenerateOptions) => {
      setError(null);
      try {
        const result = await unwrap(startGeneration({ data: options ?? {} }));
        if ("error" in result) {
          setError(result.error);
        } else {
          jobStartedAtRef.current = Date.now();
          clearJobTimeoutTimer();
          // Last-resort UI guard: stop showing the generating state even if
          // status polling somehow never reaches a terminal state.
          jobTimeoutTimerRef.current = setTimeout(() => {
            setError("generation_timed_out");
            setActiveJobId(null);
          }, MAX_JOB_POLL_MS);
          setActiveJobId(result.jobId);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    },
    [clearJobTimeoutTimer],
  );

  const generateAgain = useCallback(
    (entry: RecommendationHistoryEntry, context: RepeatGenerateContext) =>
      generate(buildGenerateAgainOptions(entry, context)),
    [generate],
  );

  const generateMore = useCallback(
    (entry: RecommendationHistoryEntry, context: RepeatGenerateContext) =>
      generate(buildGenerateMoreOptions(entry, context)),
    [generate],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      setOptimisticDeletedIds((prev) => new Set(prev).add(id));
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        logRecommendationError("delete recommendation", error);
      }
    },
    [deleteMutation],
  );

  const updateVerified = useCallback(
    async (id: string, recommendations: AIRecommendation[]) => {
      try {
        await updateVerifiedRecommendations({
          data: { id, recommendations: JSON.stringify(recommendations) },
        });
        recordOwnMutation("ai");
        void queryClient.invalidateQueries({
          queryKey: queryKeys.recommendations.history(user?.id),
        });
      } catch (error) {
        logRecommendationError("update verified recommendations", error);
      }
    },
    [queryClient, user?.id],
  );

  const loading = isSignedIn && historyQuery.isPending;

  return {
    history,
    loading,
    isGenerating,
    error,
    generate,
    generateAgain,
    generateMore,
    deleteEntry,
    updateVerified,
  };
}
