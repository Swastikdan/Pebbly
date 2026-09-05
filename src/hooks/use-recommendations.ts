import { useUser } from "@clerk/react";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AIRecommendation } from "@/domain/recommendations";
import type {
  GenerateOptions,
  RecommendationHistoryEntry,
  RepeatGenerateContext,
} from "@/lib/recommendation-options";
import { queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import {
  buildGenerateAgainOptions,
  buildGenerateMoreOptions,
} from "@/lib/recommendation-options";
import { logError as logRecommendationError } from "@/lib/utils";
import {
  deleteRecommendation,
  getRecommendationHistory,
  startGeneration,
  updateVerifiedRecommendations,
} from "@/server/fns/recommendations";
import { unwrap } from "@/server/schema/common";

// The option builders and history filtering are pure and live in
// `lib/recommendation-options.ts` (unit-testable, no React imports). Re-export
// so existing consumers keep their import path.
export {
  buildGenerateAgainOptions,
  buildGenerateMoreOptions,
  buildGenerateOptions,
  type FreshGenerateOptionsInput,
  isTrackedRecommendation,
  type GenerateOptions,
  type RecommendationHistoryEntry,
  type RepeatGenerateContext,
  selectUntrackedHistory,
  type TrackedContentSets,
} from "@/lib/recommendation-options";

// Generation is fully synchronous: `startGeneration` runs the AI call inline
// and returns the recommendations in the same response, so the client needs no
// job polling.
export function useRecommendations() {
  const { isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const historyQuery = useQuery({
    queryKey: queryKeys.recommendations.history(user?.id),
    queryFn: () => unwrap(getRecommendationHistory()),
    enabled: !!isSignedIn,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(
    new Set(),
  );

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
    async (options?: GenerateOptions): Promise<string | null> => {
      setError(null);
      setIsGenerating(true);
      try {
        const result = await unwrap(startGeneration({ data: options ?? {} }));
        if ("error" in result) {
          setError(result.error);
          return null;
        }

        recordOwnMutation("ai");
        await queryClient.invalidateQueries({
          queryKey: queryKeys.recommendations.history(user?.id),
        });
        return result.generationId ?? null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [queryClient, user?.id],
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
        await unwrap(
          updateVerifiedRecommendations({
            data: { id, recommendations: JSON.stringify(recommendations) },
          }),
        );
        recordOwnMutation("ai");
        await queryClient.invalidateQueries({
          queryKey: queryKeys.recommendations.history(user?.id),
        });
      } catch (error) {
        logRecommendationError("update verified recommendations", error);
        throw error;
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
