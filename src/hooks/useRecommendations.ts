import { useUser } from "@clerk/clerk-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import type { AIRecommendation } from "@/types";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const QUERY_SKIP = "skip" as const;

export function useRecommendationAccess() {
	const { isSignedIn, isLoaded, user } = useUser();

	const hasAccess =
		isLoaded &&
		isSignedIn === true &&
		user?.publicMetadata?.aiGenerationEnabled === true;

	return {
		hasAccess,
		loading: !isLoaded,
		isSignedIn: !!isSignedIn,
	};
}

export interface GenerateOptions {
	generationType?: "watchlist" | "genre";
	mediaTypePreference?: "movie" | "tv";
	genrePreference?: string;
	excludeTmdbIds?: number[];
	yearFrom?: number;
	yearTo?: number;
	count?: number;
}

export interface RecommendationHistoryEntry {
	_id: string;
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
	  }
	| { error: string };

export function useRecommendations() {
	const { isSignedIn } = useUser();
	const rawHistory = useQuery(
		api.recommendations.getRecommendationHistory,
		isSignedIn ? {} : QUERY_SKIP,
	);

	const generateAction = useAction(api.recommendations.generateRecommendations);
	const deleteMutation = useMutation(api.recommendations.deleteRecommendation);
	const updateVerifiedMutation = useMutation(
		api.recommendations.updateVerifiedRecommendations,
	);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(
		new Set(),
	);

	const history: RecommendationHistoryEntry[] = (rawHistory ?? [])
		.filter((entry) => !optimisticDeletedIds.has(entry._id))
		.map((entry) => ({
			_id: entry._id,
			recommendations: JSON.parse(entry.recommendations),
			inputStats: entry.inputStats,
			createdAt: entry.createdAt,
			generationType: entry.generationType ?? "watchlist",
			mediaTypePreference: entry.mediaTypePreference,
			genrePreference: entry.genrePreference,
			verified: entry.verified ?? false,
		}));

	const generate = useCallback(
		async (options?: GenerateOptions) => {
			setIsGenerating(true);
			setError(null);
			try {
				const result = (await generateAction(options ?? {})) as GenerateResult;
				if ("error" in result) {
					setError(result.error);
				}
			} catch (e) {
				setError(e instanceof Error ? e.message : "Unknown error");
			} finally {
				setIsGenerating(false);
			}
		},
		[generateAction],
	);

	const deleteEntry = useCallback(
		async (id: string) => {
			// Optimistic: hide immediately
			setOptimisticDeletedIds((prev) => new Set(prev).add(id));
			try {
				await deleteMutation({ id: id as Id<"ai_recommendations"> });
			} catch {
				// Rollback on failure
				setOptimisticDeletedIds((prev) => {
					const next = new Set(prev);
					next.delete(id);
					return next;
				});
			}
		},
		[deleteMutation],
	);

	const updateVerified = useCallback(
		async (id: string, recommendations: AIRecommendation[]) => {
			try {
				await updateVerifiedMutation({
					id: id as Id<"ai_recommendations">,
					recommendations: JSON.stringify(recommendations),
				});
			} catch {
				// silent fail — verification is best-effort
			}
		},
		[updateVerifiedMutation],
	);

	return {
		history,
		isGenerating,
		error,
		generate,
		deleteEntry,
		updateVerified,
	};
}
