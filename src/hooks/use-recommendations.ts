import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { queryKeys } from "@/lib/query/keys";
import {
	deleteRecommendation,
	generateRecommendations,
	getRecommendationHistory,
	updateVerifiedRecommendations,
} from "@/server/fns/recommendations";
import { unwrap } from "@/server/schema/common";
import type { AIRecommendation } from "@/types";

function logRecommendationError(action: string, error: unknown) {
	console.error(`Failed to ${action}`, error);
}

/** @deprecated Use `usePermissions()` from `@/hooks/usePermissions` instead. */
export function useRecommendationAccess() {
	const { hasFeature, loading, isSignedIn } = usePermissions();
	return {
		hasAccess: hasFeature("ai-recommendations"),
		loading,
		isSignedIn,
	};
}

export interface GenerateOptions {
	generationType?: "watchlist" | "list" | "genre";
	listId?: string;
	mediaTypePreference?: "movie" | "tv";
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

type GenerateResult =
	| {
			recommendations: AIRecommendation[];
			inputStats: {
				movieCount: number;
				tvCount: number;
				episodesWatched: number;
				totalItems: number;
			};
			generatedAt: number;
			cached: boolean;
			listId?: string;
	  }
	| { error: string };

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
			setIsGenerating(true);
			setError(null);
			try {
				const result: GenerateResult = await unwrap(
					generateRecommendations({ data: options ?? {} }),
				);
				if ("error" in result) {
					setError(result.error);
				} else {
					void queryClient.invalidateQueries({
						queryKey: queryKeys.recommendations.history(user?.id),
					});
				}
			} catch (e) {
				setError(e instanceof Error ? e.message : "Unknown error");
			} finally {
				setIsGenerating(false);
			}
		},
		[queryClient, user?.id],
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
		deleteEntry,
		updateVerified,
	};
}
