import { useUser } from "@clerk/clerk-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import type { AIRecommendation } from "@/types";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const QUERY_SKIP = "skip" as const;

function toRecommendationId(id: string) {
	return id as Id<"ai_recommendations">;
}

function removeFromOptimisticSet(current: Set<string>, id: string) {
	const next = new Set(current);
	next.delete(id);
	return next;
}

function logRecommendationError(action: string, error: unknown) {
	console.error(`Failed to ${action}`, error);
}

function parseRecommendationPayload(payload: string): AIRecommendation[] {
	try {
		return JSON.parse(payload) as AIRecommendation[];
	} catch (error) {
		console.error("Failed to parse recommendations payload", error);
		return [];
	}
}

export function useRecommendationAccess() {
	const { isSignedIn, isLoaded, user } = useUser();
	const publicMeta = user?.publicMetadata as
		| {
				aiGenerationEnabled?: boolean;
				public_meta?: { aiGenerationEnabled?: boolean };
		  }
		| undefined;

	const hasAccess =
		isLoaded &&
		isSignedIn === true &&
		(publicMeta?.aiGenerationEnabled ??
			publicMeta?.public_meta?.aiGenerationEnabled) === true;

	return {
		hasAccess,
		loading: !isLoaded,
		isSignedIn: !!isSignedIn,
	};
}

export interface GenerateOptions {
	generationType?: string;
	listId?: string;
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
			listId?: string;
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
			recommendations: parseRecommendationPayload(entry.recommendations),
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
				const result: GenerateResult = await generateAction(options ?? {});
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
			setOptimisticDeletedIds((prev) => new Set(prev).add(id));
			try {
				await deleteMutation({ id: toRecommendationId(id) });
			} catch (error) {
				logRecommendationError("delete recommendation", error);
				setOptimisticDeletedIds((prev) => removeFromOptimisticSet(prev, id));
			}
		},
		[deleteMutation],
	);

	const updateVerified = useCallback(
		async (id: string, recommendations: AIRecommendation[]) => {
			try {
				await updateVerifiedMutation({
					id: toRecommendationId(id),
					recommendations: JSON.stringify(recommendations),
				});
			} catch (error) {
				logRecommendationError("update verified recommendations", error);
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
