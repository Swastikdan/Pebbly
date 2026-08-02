import { useUser } from "@clerk/react";
import { Link } from "@tanstack/react-router";
import {
	useAction,
	useQuery as useConvexQuery,
	useMutation,
} from "convex/react";
import { Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import {
	type AIRecommendation,
	titlesMatch,
	useTmdbData,
	useTmdbSearchFallback,
} from "@/lib/recommendation-engine";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

const getDismissKey = (rec: AIRecommendation) =>
	`${rec.mediaType}:${rec.tmdbId ?? ""}:${rec.title}`;

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
		isLiked: isLikedProp,
		onFeedback,
	}: {
		recommendation: AIRecommendation;
		likedIds?: Set<number>;
		isLiked?: boolean;
		onFeedback: (
			rec: AIRecommendation,
			resolvedId: number,
			feedback: "not_interested" | "like" | "unlike",
			metadata?: {
				image?: string;
				rating?: number;
				release_date?: string;
				overview?: string;
			},
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

		const isLiked =
			isLikedProp !== undefined
				? isLikedProp
				: likedIds
					? likedIds.has(resolvedData.id)
					: false;

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
							"h-8 w-8 rounded-lg bg-black/45 text-white border backdrop-blur-sm transition-[color,background-color,box-shadow,transform] duration-200 hover:scale-105 active:scale-95 cursor-pointer pressable",
							isLiked
								? "bg-green-500/25 text-green-400 border-green-500/40 hover:bg-green-500/35"
								: "border-transparent hover:bg-black/60",
						)}
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							onFeedback(
								recommendation,
								resolvedData.id,
								isLiked ? "unlike" : "like",
								{
									image: resolvedData.posterPath ?? undefined,
									rating: resolvedData.rating,
									release_date: resolvedData.releaseDate ?? undefined,
									overview: resolvedData.overview,
								},
							);
						}}
						title={isLiked ? "Remove like" : "Recommend more like this"}
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
						className="h-8 w-8 rounded-lg bg-black/45 text-white border border-transparent backdrop-blur-sm transition-[color,background-color,border-color,transform] duration-200 hover:bg-red-500/25 hover:text-red-400 hover:border-red-500/40 hover:scale-105 active:scale-95 cursor-pointer pressable"
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

// Module-level cache to prevent flashes during navigation
let cachedRecommendations: {
	userId: string | null;
	// biome-ignore lint/suspicious/noExplicitAny: Cached Convex query result
	recommendationsData: any;
	// biome-ignore lint/suspicious/noExplicitAny: Cached Convex query result
	feedbackList: any;
} | null = null;

export function HomepageRecommendations() {
	const { isSignedIn, isLoaded, user } = useUser();
	const { hasFeature } = usePermissions();
	const [localDismissedKeys, setLocalDismissedKeys] = useState<Set<string>>(
		new Set(),
	);
	const [hourBucket] = useState(
		() => Math.floor(Date.now() / (1000 * 60 * 60)) * (1000 * 60 * 60),
	);

	const canAccessFeature = isSignedIn && hasFeature("ai-recommendations");

	const recommendationsData = useConvexQuery(
		api.recommendations.getHomepageRecommendations,
		canAccessFeature ? {} : "skip",
	);

	const feedbackList = useConvexQuery(
		api.recommendations.getRecommendationFeedback,
		canAccessFeature ? {} : "skip",
	);

	// Update module-level cache when fresh data is loaded
	useEffect(() => {
		if (recommendationsData && feedbackList) {
			cachedRecommendations = {
				userId: user?.id ?? null,
				recommendationsData,
				feedbackList,
			};
		}
	}, [recommendationsData, feedbackList, user?.id]);

	// Use cached data as fallback to prevent skeleton flashes during page transitions
	const hasCache =
		cachedRecommendations &&
		cachedRecommendations.userId === (user?.id ?? null);
	const resolvedRecsData =
		recommendationsData ||
		(hasCache
			? (cachedRecommendations?.recommendationsData as typeof recommendationsData)
			: null);
	const resolvedFeedbackList =
		feedbackList ||
		(hasCache
			? (cachedRecommendations?.feedbackList as typeof feedbackList)
			: null);

	const generateRecs = useAction(
		api.recommendations.generateHomepageRecommendations,
	);
	const setFeedback = useMutation(
		api.recommendations.setRecommendationFeedback,
	);
	const removeFeedback = useMutation(
		api.recommendations.removeRecommendationFeedback,
	);

	const [isGenerating, setIsGenerating] = useState(false);
	const isGeneratingRef = useRef(false);

	useEffect(() => {
		if (
			canAccessFeature &&
			resolvedRecsData?.needsRefresh &&
			!isGeneratingRef.current
		) {
			isGeneratingRef.current = true;
			setIsGenerating(true);
			generateRecs()
				.catch((err) => {
					console.error("Failed to generate homepage recommendations:", err);
				})
				.finally(() => {
					setIsGenerating(false);
					isGeneratingRef.current = false;
				});
		}
	}, [canAccessFeature, resolvedRecsData?.needsRefresh, generateRecs]);

	const likedIds = useMemo(() => {
		const set = new Set<number>();
		for (const f of resolvedFeedbackList ?? []) {
			if (f.feedback === "like") {
				set.add(f.tmdbId);
			}
		}
		return set;
	}, [resolvedFeedbackList]);

	const recs = useMemo(() => {
		if (!resolvedRecsData?.recommendations) return [];
		return resolvedRecsData.recommendations.filter(
			(r) => !localDismissedKeys.has(getDismissKey(r)),
		);
	}, [resolvedRecsData?.recommendations, localDismissedKeys]);

	const handleFeedback = useCallback(
		async (
			rec: AIRecommendation,
			resolvedId: number,
			feedback: "not_interested" | "like" | "unlike",
			metadata?: {
				image?: string;
				rating?: number;
				release_date?: string;
				overview?: string;
			},
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
				if (feedback === "unlike") {
					await removeFeedback({
						tmdbId: resolvedId,
						mediaType: rec.mediaType,
					});
				} else {
					await setFeedback({
						tmdbId: resolvedId,
						mediaType: rec.mediaType,
						title: rec.title,
						feedback,
						image: metadata?.image,
						rating: metadata?.rating,
						release_date: metadata?.release_date,
						overview: metadata?.overview,
					});
				}
			} catch (err) {
				console.error("Failed to update recommendation feedback:", err);
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
		[setFeedback, removeFeedback],
	);

	if (!isLoaded || !canAccessFeature) {
		return null;
	}

	const hasNoWatchHistory =
		resolvedRecsData?.status === "failed" &&
		(!resolvedRecsData.recommendations ||
			resolvedRecsData.recommendations.length === 0);

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

	if (!resolvedRecsData) {
		return (
			<div className="my-6">
				<div className="flex items-center justify-between px-4 md:px-0 mb-1">
					<div className="flex items-center gap-2">
						<h2 className="font-semibold text-lg md:text-xl">Picks For You</h2>
						<Sparkles size={14} className="text-primary/70 animate-pulse" />
					</div>
					<Link
						to="/recommendations"
						search={{ activeId: undefined }}
						className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
					>
						See All →
					</Link>
				</div>
				<MediaSkeletonList />
			</div>
		);
	}

	if (recs.length === 0) {
		if (isGenerating) {
			return (
				<div className="my-6">
					<div className="flex items-center justify-between px-4 md:px-0 mb-1">
						<div className="flex items-center gap-2">
							<h2 className="font-semibold text-lg md:text-xl">
								Picks For You
							</h2>
							<Sparkles size={14} className="text-primary/70 animate-pulse" />
						</div>
						<Link
							to="/recommendations"
							search={{ activeId: undefined }}
							className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
						>
							See All →
						</Link>
					</div>
					<MediaSkeletonList />
				</div>
			);
		}
		return null;
	}

	return (
		<div className="w-full my-6">
			<section className="w-full">
				<div className="flex items-center justify-between px-4 md:px-0 mb-1">
					<div className="flex items-center gap-2">
						<h2 className="font-semibold text-lg md:text-xl">Picks For You</h2>
						<Sparkles size={14} className="text-primary/70 animate-pulse" />
					</div>
					<Link
						to="/recommendations"
						search={{ activeId: undefined }}
						className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
					>
						See All →
					</Link>
				</div>
				<ScrollContainer isButtonsVisible={true}>
					<div className="flex gap-2 p-4 first:pl-0 last:pr-0">
						{recs.map((rec) => (
							<HomepageRecommendationCard
								key={getDismissKey(rec)}
								recommendation={rec}
								isLiked={rec.tmdbId ? likedIds.has(rec.tmdbId) : undefined}
								likedIds={rec.tmdbId ? undefined : likedIds}
								onFeedback={handleFeedback}
							/>
						))}
					</div>
				</ScrollContainer>
			</section>
		</div>
	);
}
