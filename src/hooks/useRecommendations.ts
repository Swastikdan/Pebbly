import { useUser } from "@clerk/clerk-react";
import { useAction, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { AIRecommendation } from "@/types";

const QUERY_SKIP = "skip" as const;

export function useRecommendationAccess() {
	const { isSignedIn } = useUser();
	const access = useQuery(
		api.recommendations.getUserRecommendationAccess,
		isSignedIn ? {} : QUERY_SKIP,
	);

	return {
		hasAccess: access?.hasAccess ?? false,
		loading: isSignedIn && access === undefined,
		reason: access?.reason,
		isSignedIn: !!isSignedIn,
	};
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
	const cached = useQuery(
		api.recommendations.getCachedRecommendations,
		isSignedIn ? {} : QUERY_SKIP,
	);

	const generateAction = useAction(api.recommendations.generateRecommendations);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const parsedRecommendations: AIRecommendation[] | null =
		cached?.recommendations ? JSON.parse(cached.recommendations) : null;

	const generate = useCallback(async () => {
		setIsGenerating(true);
		setError(null);
		try {
			const result = (await generateAction()) as GenerateResult;
			if ("error" in result) {
				setError(result.error);
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unknown error");
		} finally {
			setIsGenerating(false);
		}
	}, [generateAction]);

	return {
		recommendations: parsedRecommendations,
		inputStats: cached?.inputStats ?? null,
		generatedAt: cached?.createdAt ?? null,
		model: cached?.model ?? null,
		isGenerating,
		error,
		generate,
	};
}
