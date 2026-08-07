import { useUser } from "@clerk/react";
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
	useAllMediaStates,
	useToggleWatchlistItem,
} from "@/hooks/use-watchlist";
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

import { MediaSkeletonList } from "@/components/ui/media-skeleton-list";

const HomepageRecommendationCard = memo(
	({
		recommendation,
		likedKeys,
		onFeedback,
	}: {
		recommendation: AIRecommendation;
		likedKeys: Set<string>;
		onFeedback: (
			rec: AIRecommendation,
			resolvedId: number,
			feedback: "dislike" | "like" | "unlike",
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

		const isLiked = likedKeys.has(`${mediaType}:${resolvedData.id}`);

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
					hideWatchlistButton={true}
				/>

				{/* Top-right solid action buttons overlay */}
				<div className="absolute right-2 top-2 z-20 flex gap-1.5 animate-fade-in opacity-0 group-hover/rec-card:opacity-100 transition-opacity duration-300 md:opacity-100">
					<Button
						variant="secondary"
						size="icon"
						className={cn(
							"h-8 w-8 rounded-lg border shadow-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer pressable",
							isLiked
								? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700"
								: "bg-neutral-900/90 text-white border-neutral-700 hover:bg-neutral-800",
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
						title={
							isLiked ? "Remove from Watchlist" : "Add to Watchlist & Like"
						}
					>
						<ThumbsUp
							size={13}
							className={isLiked ? "fill-white text-white" : "text-white"}
						/>
					</Button>
					<Button
						variant="secondary"
						size="icon"
						className="h-8 w-8 rounded-lg bg-neutral-900/90 text-white border border-neutral-700 shadow-md transition-all duration-200 hover:bg-red-900/90 hover:border-red-600 hover:text-red-200 hover:scale-105 active:scale-95 cursor-pointer pressable"
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							onFeedback(recommendation, resolvedData.id, "dislike");
						}}
						title="Dislike"
					>
						<ThumbsDown size={13} />
					</Button>
				</div>
			</div>
		);
	},
);

function RecommendationSectionHeader() {
	return (
		<div className="flex items-center justify-between px-4 md:px-0 mb-1">
			<h2 className="font-semibold text-lg md:text-xl">Picks For You</h2>
		</div>
	);
}

export function HomepageRecommendations() {
	const { isSignedIn, isLoaded, user } = useUser();
	const { hasFeature } = usePermissions();
	const [localDismissedKeys, setLocalDismissedKeys] = useState<Set<string>>(
		new Set(),
	);
	const [localLikedKeys, setLocalLikedKeys] = useState<Set<string>>(new Set());
	const [_hourBucket] = useState(
		() => Math.floor(Date.now() / (1000 * 60 * 60)) * (1000 * 60 * 60),
	);

	const cachedRecommendationsRef = useRef<{
		userId: string | null;
		// biome-ignore lint/suspicious/noExplicitAny: Cached Convex query result
		recommendationsData: any;
		// biome-ignore lint/suspicious/noExplicitAny: Cached Convex query result
		feedbackList: any;
	} | null>(null);

	const canAccessFeature = isSignedIn && hasFeature("ai-recommendations");

	const recommendationsData = useConvexQuery(
		api.recommendations.getHomepageRecommendations,
		canAccessFeature ? {} : "skip",
	);

	const feedbackList = useConvexQuery(
		api.recommendations.getRecommendationFeedback,
		canAccessFeature ? {} : "skip",
	);

	// Update ref cache when fresh data is loaded
	useEffect(() => {
		if (recommendationsData && feedbackList) {
			cachedRecommendationsRef.current = {
				userId: user?.id ?? null,
				recommendationsData,
				feedbackList,
			};
		}
	}, [recommendationsData, feedbackList, user?.id]);

	// Use cached data as fallback to prevent skeleton flashes during page transitions
	const hasCache =
		cachedRecommendationsRef.current &&
		cachedRecommendationsRef.current.userId === (user?.id ?? null);
	const resolvedRecsData =
		recommendationsData ||
		(hasCache
			? (cachedRecommendationsRef.current
					?.recommendationsData as typeof recommendationsData)
			: null);
	const resolvedFeedbackList =
		feedbackList ||
		(hasCache
			? (cachedRecommendationsRef.current?.feedbackList as typeof feedbackList)
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

	const toggleWatchlist = useToggleWatchlistItem();

	const likedKeys = useMemo(() => {
		const set = new Set<string>(localLikedKeys);
		for (const f of resolvedFeedbackList ?? []) {
			if (f.feedback === "like") {
				set.add(`${f.mediaType}:${f.tmdbId}`);
			}
		}
		return set;
	}, [resolvedFeedbackList, localLikedKeys]);

	const dislikedKeys = useMemo(() => {
		const set = new Set<string>();
		for (const f of resolvedFeedbackList ?? []) {
			if (f.feedback === "not_interested") {
				set.add(`${f.mediaType}:${f.tmdbId}`);
			}
		}
		return set;
	}, [resolvedFeedbackList]);

	const { allMediaStates } = useAllMediaStates();
	const watchlistKeys = useMemo(() => {
		const set = new Set<string>();
		for (const item of allMediaStates) {
			if (
				item.inWatchlist ||
				item.progressStatus === "watching" ||
				(item.progress ?? 0) > 0
			) {
				set.add(`${item.type}:${item.external_id}`);
			}
		}
		return set;
	}, [allMediaStates]);

	const recs = useMemo(() => {
		if (!resolvedRecsData?.recommendations) return [];
		return resolvedRecsData.recommendations.filter((r) => {
			if (localDismissedKeys.has(getDismissKey(r))) return false;
			if (r.tmdbId !== null && r.tmdbId !== undefined) {
				const key = `${r.mediaType}:${r.tmdbId}`;
				if (dislikedKeys.has(key)) return false;
				if (watchlistKeys.has(key) && !likedKeys.has(key)) return false;
			}
			return true;
		});
	}, [
		resolvedRecsData?.recommendations,
		localDismissedKeys,
		watchlistKeys,
		likedKeys,
		dislikedKeys,
	]);

	const handleFeedback = useCallback(
		async (
			rec: AIRecommendation,
			resolvedId: number,
			feedback: "dislike" | "like" | "unlike",
			metadata?: {
				image?: string;
				rating?: number;
				release_date?: string;
				overview?: string;
			},
		) => {
			const key = getDismissKey(rec);

			const mediaKey = `${rec.mediaType}:${resolvedId}`;

			if (feedback === "dislike") {
				// Hide card immediately on UI
				setLocalDismissedKeys((prev) => {
					const next = new Set(prev);
					next.add(key);
					return next;
				});
			} else if (feedback === "like") {
				setLocalLikedKeys((prev) => {
					const next = new Set(prev);
					next.add(mediaKey);
					return next;
				});
			} else if (feedback === "unlike") {
				setLocalLikedKeys((prev) => {
					const next = new Set(prev);
					next.delete(mediaKey);
					return next;
				});
			}

			// Toggle watchlist item if liking or unliking
			if (feedback === "like" || feedback === "unlike") {
				toggleWatchlist({
					id: String(resolvedId),
					title: rec.title,
					media_type: rec.mediaType,
					rating: metadata?.rating ?? 0,
					image: metadata?.image ?? "",
					release_date: metadata?.release_date ?? "",
					overview: metadata?.overview,
				}).catch(console.error);
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
						feedback: feedback === "dislike" ? "not_interested" : "like",
						image: metadata?.image,
						rating: metadata?.rating,
						release_date: metadata?.release_date,
						overview: metadata?.overview,
					});
				}
			} catch (err) {
				console.error("Failed to update recommendation feedback:", err);
				if (feedback === "dislike") {
					// Revert local dismiss on failure
					setLocalDismissedKeys((prev) => {
						const next = new Set(prev);
						next.delete(key);
						return next;
					});
				} else if (feedback === "like") {
					setLocalLikedKeys((prev) => {
						const next = new Set(prev);
						next.delete(mediaKey);
						return next;
					});
				} else if (feedback === "unlike") {
					setLocalLikedKeys((prev) => {
						const next = new Set(prev);
						next.add(mediaKey);
						return next;
					});
				}
			}
		},
		[setFeedback, removeFeedback, toggleWatchlist],
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
				<RecommendationSectionHeader />
				<MediaSkeletonList />
			</div>
		);
	}

	if (recs.length === 0) {
		if (isGenerating) {
			return (
				<div className="my-6">
					<RecommendationSectionHeader />
					<MediaSkeletonList />
				</div>
			);
		}
		return null;
	}

	return (
		<div className="w-full my-6">
			<section className="w-full">
				<RecommendationSectionHeader />
				<ScrollContainer isButtonsVisible={true}>
					<div className="flex gap-2 p-4 first:pl-0 last:pr-0">
						{recs.map((rec) => (
							<HomepageRecommendationCard
								key={getDismissKey(rec)}
								recommendation={rec}
								likedKeys={likedKeys}
								onFeedback={handleFeedback}
							/>
						))}
					</div>
				</ScrollContainer>
			</section>
		</div>
	);
}
