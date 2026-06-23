import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import {
	useAction,
	useQuery as useConvexQuery,
	useMutation,
} from "convex/react";
import { Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import {
	getBasicMovieDetails,
	getBasicTvDetails,
	getSearchResult,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { BasicMovie, BasicTv } from "@/types";
import { api } from "../../convex/_generated/api";

interface AIRecommendation {
	title: string;
	tmdbId: number | null;
	mediaType: "movie" | "tv";
	relevanceScore: number;
	reasoning: string;
}

interface NormalizedTmdbData {
	id: number;
	title: string;
	posterPath: string | null;
	rating: number;
	releaseDate: string | null;
	overview: string;
}

const getDismissKey = (rec: AIRecommendation) =>
	`${rec.mediaType}:${rec.tmdbId ?? ""}:${rec.title}`;

function normalizeTmdbData(
	data: BasicMovie | BasicTv | null | undefined,
	mediaType: "movie" | "tv",
): NormalizedTmdbData | null {
	if (!data) return null;
	if (mediaType === "movie") {
		const m = data as BasicMovie;
		return {
			id: m.id,
			title: m.title,
			posterPath: m.poster_path || null,
			rating: m.vote_average,
			releaseDate: m.release_date || null,
			overview: m.overview,
		};
	}
	const t = data as BasicTv;
	return {
		id: t.id,
		title: t.name,
		posterPath: t.poster_path || null,
		rating: t.vote_average,
		releaseDate: t.first_air_date || null,
		overview: t.overview,
	};
}

function titlesMatch(aiTitle: string, tmdbTitle: string): boolean {
	const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
	const a = normalize(aiTitle);
	const b = normalize(tmdbTitle);
	return a === b || a.includes(b) || b.includes(a);
}

function useTmdbData(tmdbId: number | null, mediaType: "movie" | "tv") {
	const {
		data: movieData,
		isLoading: movieLoading,
		isError: movieError,
	} = useQuery({
		queryKey: ["basic_movie_details", tmdbId],
		queryFn: () => getBasicMovieDetails({ id: tmdbId as number }),
		enabled: !!tmdbId && mediaType === "movie",
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	const {
		data: tvData,
		isLoading: tvLoading,
		isError: tvError,
	} = useQuery({
		queryKey: ["basic_tv_details", tmdbId],
		queryFn: () => getBasicTvDetails({ id: tmdbId as number }),
		enabled: !!tmdbId && mediaType === "tv",
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (!tmdbId) return { data: null, isLoading: false, exists: false };

	const data = mediaType === "movie" ? movieData : tvData;
	const isLoading = mediaType === "movie" ? movieLoading : tvLoading;
	const isError = mediaType === "movie" ? movieError : tvError;

	return {
		data: normalizeTmdbData(data, mediaType),
		isLoading,
		exists: !!data && !isError,
	};
}

function useTmdbSearchFallback(
	title: string,
	mediaType: "movie" | "tv",
	shouldSearch: boolean,
) {
	const { data: searchData, isLoading: searchLoading } = useQuery({
		queryKey: ["tmdb_search_fallback", title, mediaType],
		queryFn: async () => {
			const results = await getSearchResult(title, 1);
			const filtered = (results.results ?? []).filter(
				(r) => r.media_type === mediaType,
			);
			if (filtered.length === 0) return null;
			const first = filtered[0];
			const resultTitle =
				mediaType === "movie"
					? (first.title ?? first.name ?? "")
					: (first.name ?? first.title ?? "");

			if (!titlesMatch(title, resultTitle)) return null;

			const rating = first.vote_average ?? 0;
			if (rating === 0 || !first.poster_path || !resultTitle) return null;

			return {
				id: first.id,
				title: resultTitle,
				posterPath: first.poster_path ?? null,
				rating,
				releaseDate:
					mediaType === "movie"
						? (first.release_date ?? null)
						: (first.first_air_date ?? null),
				overview: first.overview ?? "",
			} as NormalizedTmdbData;
		},
		enabled: shouldSearch,
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	return {
		data: searchData ?? null,
		isLoading: searchLoading && shouldSearch,
		exists: !!searchData,
	};
}

const MediaSkeletonList = memo(
	(props: { count?: number; cardType?: "horizontal" | "vertical" }) => {
		const cardCount = props.count ?? 6;
		return (
			<ScrollContainer isButtonsVisible={false}>
				<div className="flex gap-2 p-4 first:pl-0 last:pr-0">
					{Array.from({ length: cardCount }).map((_, index) => (
						<MediaCardSkeleton
							key={index}
							card_type={props.cardType ?? "horizontal"}
						/>
					))}
				</div>
			</ScrollContainer>
		);
	},
);

const HomepageRecommendationCard = memo(
	({
		recommendation,
		likedIds,
		onFeedback,
	}: {
		recommendation: AIRecommendation;
		likedIds: Set<number>;
		onFeedback: (
			rec: AIRecommendation,
			resolvedId: number,
			feedback: "not_interested" | "like",
		) => void;
	}) => {
		const { title, tmdbId, mediaType } = recommendation;
		const {
			data: tmdbData,
			isLoading: idLoading,
			exists: idExists,
		} = useTmdbData(tmdbId, mediaType);

		const idVerified =
			tmdbData &&
			idExists &&
			titlesMatch(title, tmdbData.title) &&
			tmdbData.rating > 0 &&
			!!tmdbData.posterPath;
		const idResolved = !tmdbId || !idLoading;

		const shouldSearch = idResolved && !idVerified;
		const {
			data: searchData,
			isLoading: searchLoading,
			exists: searchExists,
		} = useTmdbSearchFallback(title, mediaType, shouldSearch);

		const resolvedData = idVerified
			? tmdbData
			: searchExists
				? searchData
				: null;
		const isStillLoading =
			(!!tmdbId && idLoading) || (shouldSearch && searchLoading);

		if (isStillLoading) {
			return <MediaCardSkeleton card_type="horizontal" />;
		}

		if (!resolvedData) {
			return null;
		}

		const isLiked = likedIds.has(resolvedData.id);

		return (
			<div className="relative group/rec-card">
				<MediaCard
					card_type="horizontal"
					id={resolvedData.id}
					title={resolvedData.title}
					rating={resolvedData.rating}
					image={resolvedData.posterPath ?? ""}
					poster_path={resolvedData.posterPath ?? ""}
					media_type={mediaType}
					release_date={resolvedData.releaseDate}
					overview={resolvedData.overview}
					is_on_homepage={true}
					relevanceScore={recommendation.relevanceScore}
				/>

				{/* Top-left absolute overlays for feedback buttons */}
				<div className="absolute left-2 top-2 z-20 flex gap-1 animate-fade-in opacity-0 group-hover/rec-card:opacity-100 transition-opacity duration-300 md:opacity-100">
					<Button
						variant="secondary"
						size="icon"
						className={cn(
							"h-8 w-8 rounded-lg bg-black/45 text-white border backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer pressable",
							isLiked
								? "bg-green-500/25 text-green-400 border-green-500/40 hover:bg-green-500/35"
								: "border-transparent hover:bg-black/60",
						)}
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							onFeedback(recommendation, resolvedData.id, "like");
						}}
						title="Recommend more like this"
					>
						<ThumbsUp
							size={13}
							className={
								isLiked ? "fill-green-400 text-green-400" : "text-white"
							}
						/>
					</Button>
					<Button
						variant="secondary"
						size="icon"
						className="h-8 w-8 rounded-lg bg-black/45 text-white border border-transparent backdrop-blur-sm transition-all duration-200 hover:bg-red-500/25 hover:text-red-400 hover:border-red-500/40 hover:scale-105 active:scale-95 cursor-pointer pressable"
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							onFeedback(recommendation, resolvedData.id, "not_interested");
						}}
						title="Not interested"
					>
						<ThumbsDown size={13} />
					</Button>
				</div>
			</div>
		);
	},
);

export function HomepageRecommendations() {
	const { isSignedIn, isLoaded } = useUser();
	const [localDismissedKeys, setLocalDismissedKeys] = useState<Set<string>>(
		new Set(),
	);

	const recommendationsData = useConvexQuery(
		api.recommendations.getHomepageRecommendations,
		isSignedIn ? {} : "skip",
	);

	const feedbackList = useConvexQuery(
		api.recommendations.getRecommendationFeedback,
		isSignedIn ? {} : "skip",
	);

	const generateRecs = useAction(
		api.recommendations.generateHomepageRecommendations,
	);
	const setFeedback = useMutation(
		api.recommendations.setRecommendationFeedback,
	);

	const [isGenerating, setIsGenerating] = useState(false);

	useEffect(() => {
		if (isSignedIn && recommendationsData?.needsRefresh && !isGenerating) {
			setIsGenerating(true);
			generateRecs()
				.catch((err) => {
					console.error("Failed to generate homepage recommendations:", err);
				})
				.finally(() => {
					setIsGenerating(false);
				});
		}
	}, [
		isSignedIn,
		recommendationsData?.needsRefresh,
		generateRecs,
		isGenerating,
	]);

	const likedIds = useMemo(() => {
		const set = new Set<number>();
		for (const f of feedbackList ?? []) {
			if (f.feedback === "like") {
				set.add(f.tmdbId);
			}
		}
		return set;
	}, [feedbackList]);

	const recs = useMemo(() => {
		if (!recommendationsData?.recommendations) return [];
		return recommendationsData.recommendations.filter(
			(r) => !localDismissedKeys.has(getDismissKey(r)),
		);
	}, [recommendationsData?.recommendations, localDismissedKeys]);

	const handleFeedback = useCallback(
		async (
			rec: AIRecommendation,
			resolvedId: number,
			feedback: "not_interested" | "like",
		) => {
			const key = getDismissKey(rec);

			if (feedback === "not_interested") {
				// Hide card immediately on UI
				setLocalDismissedKeys((prev) => {
					const next = new Set(prev);
					next.add(key);
					return next;
				});
			}

			try {
				await setFeedback({
					tmdbId: resolvedId,
					mediaType: rec.mediaType,
					title: rec.title,
					feedback,
				});
			} catch (err) {
				console.error("Failed to set recommendation feedback:", err);
				if (feedback === "not_interested") {
					// Revert local dismiss on failure
					setLocalDismissedKeys((prev) => {
						const next = new Set(prev);
						next.delete(key);
						return next;
					});
				}
			}
		},
		[setFeedback],
	);

	const { hasFeature } = usePermissions();

	if (!isLoaded || !isSignedIn || !hasFeature("ai-recommendations")) {
		return null;
	}

	const hasNoWatchHistory =
		recommendationsData?.status === "failed" &&
		(!recommendationsData.recommendations ||
			recommendationsData.recommendations.length === 0);

	if (hasNoWatchHistory) {
		return (
			<section className="w-full text-left py-4 px-4 border border-border/40 rounded-xl bg-card/40 my-6">
				<div className="flex items-center gap-2 mb-2 text-muted-foreground">
					<Sparkles size={16} className="text-primary animate-pulse" />
					<h3 className="font-semibold text-sm">
						Personalized Recommendations
					</h3>
				</div>
				<p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
					Add some movies or TV shows to your watchlist to start receiving
					personalized recommendations refreshed twice a day.
				</p>
			</section>
		);
	}

	if (!recommendationsData) {
		return (
			<div className="my-6">
				<h2 className="font-semibold text-lg md:text-xl px-4 md:px-0 mb-1">
					Picks For You
				</h2>
				<MediaSkeletonList />
			</div>
		);
	}

	if (recs.length === 0) {
		if (isGenerating) {
			return (
				<div className="my-6">
					<h2 className="font-semibold text-lg md:text-xl px-4 md:px-0 mb-1">
						Picks For You
					</h2>
					<MediaSkeletonList />
				</div>
			);
		}
		return null;
	}

	return (
		<div className="w-full my-6">
			<section className="w-full">
				<div className="flex items-center gap-2 px-4 md:px-0 mb-1">
					<h2 className="font-semibold text-lg md:text-xl">Picks For You</h2>
					<Sparkles size={14} className="text-primary/70 animate-pulse" />
				</div>
				<ScrollContainer isButtonsVisible={true}>
					<div className="flex gap-2 p-4 first:pl-0 last:pr-0">
						{recs.map((rec) => (
							<HomepageRecommendationCard
								key={getDismissKey(rec)}
								recommendation={rec}
								likedIds={likedIds}
								onFeedback={handleFeedback}
							/>
						))}
					</div>
				</ScrollContainer>
			</section>
		</div>
	);
}
