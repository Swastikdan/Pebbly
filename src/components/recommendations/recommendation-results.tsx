import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { formatTimestamp } from "@/components/recommendations/recommendation-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaGrid } from "@/components/ui/media-grid";
import type { RecommendationHistoryEntry } from "@/hooks/use-recommendations";
import {
	type AIRecommendation,
	titlesMatch,
	useTmdbData,
	useTmdbSearchFallback,
} from "@/lib/recommendation-engine";
import { cn } from "@/lib/utils";

export function RecommendationResults({
	entry,
	updateVerified,
}: {
	entry: RecommendationHistoryEntry;
	updateVerified: (id: string, recs: AIRecommendation[]) => Promise<void>;
}) {
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
				<Badge variant="outline" className="text-[10px] font-medium capitalize">
					{entry.generationType === "genre"
						? "By Genre"
						: entry.generationType === "list"
							? "Custom List"
							: "Watchlist"}
				</Badge>
				{entry.genrePreference && <span>{entry.genrePreference}</span>}
				{entry.mediaTypePreference && (
					<span className="capitalize">
						{entry.mediaTypePreference === "movie" ? "Movies only" : "TV only"}
					</span>
				)}
				<span>
					{entry.inputStats.movieCount} movies, {entry.inputStats.tvCount} TV
					shows
				</span>
				<span>{formatTimestamp(entry.createdAt)}</span>
			</div>

			<RecommendationCardGrid entry={entry} updateVerified={updateVerified} />
		</div>
	);
}

function RecommendationCardGrid({
	entry,
	updateVerified,
}: {
	entry: RecommendationHistoryEntry;
	updateVerified: (id: string, recs: AIRecommendation[]) => Promise<void>;
}) {
	const verifiedMapRef = useRef<Map<number, AIRecommendation>>(new Map());
	const totalCount = entry.recommendations.length;
	const resolvedCountRef = useRef(0);
	const hasPushedRef = useRef(false);

	const entryId = entry.id;

	// biome-ignore lint/correctness/useExhaustiveDependencies: entryId is intentionally used to reset refs when the entry changes
	useEffect(() => {
		verifiedMapRef.current = new Map();
		resolvedCountRef.current = 0;
		hasPushedRef.current = false;
	}, [entryId]);

	const onCardResolved = useCallback(
		(index: number, verifiedRec: AIRecommendation) => {
			verifiedMapRef.current.set(index, verifiedRec);
			resolvedCountRef.current += 1;

			if (
				!hasPushedRef.current &&
				!entry.verified &&
				resolvedCountRef.current >= totalCount
			) {
				hasPushedRef.current = true;

				const hasAnyVerified = Array.from(verifiedMapRef.current.values()).some(
					(r) => !!r.verifiedTmdbId,
				);

				if (hasAnyVerified) {
					const updatedRecs = entry.recommendations.map((rec, i) => {
						const verified = verifiedMapRef.current.get(i);
						if (verified?.verifiedTmdbId) return verified;
						return rec;
					});
					updateVerified(entryId, updatedRecs);
				}
			}
		},
		[
			entryId,
			entry.verified,
			entry.recommendations,
			totalCount,
			updateVerified,
		],
	);

	return (
		<MediaGrid stagger>
			{entry.recommendations.map((rec, i) => (
				<RecommendationCard
					key={rec.tmdbId ?? rec.title}
					recommendation={rec}
					isEntryVerified={!!entry.verified}
					onResolved={(verifiedRec) => onCardResolved(i, verifiedRec)}
				/>
			))}
		</MediaGrid>
	);
}

function RecommendationCard({
	recommendation,
	isEntryVerified,
	onResolved,
}: {
	recommendation: AIRecommendation;
	isEntryVerified: boolean;
	onResolved?: (verifiedRec: AIRecommendation) => void;
}) {
	const { title, tmdbId, mediaType, relevanceScore, reasoning } =
		recommendation;
	const navigate = useNavigate();
	const hasReportedRef = useRef(false);

	const usesCachedData = isEntryVerified && !!recommendation.verifiedTmdbId;

	const {
		data: tmdbData,
		isLoading: idLoading,
		exists: idExists,
	} = useTmdbData(usesCachedData ? null : tmdbId, mediaType);

	const idVerified =
		!usesCachedData &&
		tmdbData &&
		idExists &&
		titlesMatch(title, tmdbData.title) &&
		tmdbData.rating > 0 &&
		!!tmdbData.posterPath;
	const idResolved = usesCachedData || !tmdbId || !idLoading;

	const shouldSearch = !usesCachedData && idResolved && !idVerified;
	const {
		data: searchData,
		isLoading: searchLoading,
		exists: searchExists,
	} = useTmdbSearchFallback(title, mediaType, shouldSearch);

	const resolvedData = usesCachedData
		? null
		: idVerified
			? tmdbData
			: searchExists
				? searchData
				: null;

	const isStillLoading =
		!usesCachedData &&
		((!!tmdbId && idLoading) || (shouldSearch && searchLoading));

	useEffect(() => {
		if (usesCachedData || hasReportedRef.current || isStillLoading) return;
		hasReportedRef.current = true;

		if (resolvedData && onResolved) {
			onResolved({
				...recommendation,
				verifiedTmdbId: resolvedData.id,
				verifiedTitle: resolvedData.title,
				posterPath: resolvedData.posterPath,
				rating: resolvedData.rating,
				releaseDate: resolvedData.releaseDate,
				overview: resolvedData.overview,
			});
		} else if (onResolved) {
			// Keep unresolved cards in the batch so backend verification can finish.
			onResolved(recommendation);
		}
	}, [
		usesCachedData,
		isStillLoading,
		resolvedData,
		recommendation,
		onResolved,
	]);

	function RecommendationReasoningOverlay({
		reasoning,
		title,
	}: {
		reasoning?: string;
		title: string;
	}) {
		const [showReason, setShowReason] = useState(false);
		if (!reasoning) return null;

		return (
			<div className="absolute left-2 bottom-2 right-2 z-20 pointer-events-auto">
				{showReason ? (
					<div className="rounded-xl bg-stone-950/95 text-white border border-stone-700/80 backdrop-blur-md p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
						<div className="flex items-center justify-between gap-2 mb-1.5 border-b border-stone-800 pb-1.5">
							<span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
								<Sparkles size={12} className="text-primary shrink-0" />
								Why this pick
							</span>
							<button
								type="button"
								className="text-[11px] font-medium text-stone-400 hover:text-white px-2 py-0.5 rounded-md hover:bg-stone-800 transition-colors cursor-pointer"
								onClick={(e) => {
									e.stopPropagation();
									e.preventDefault();
									setShowReason(false);
								}}
							>
								Close
							</button>
						</div>
						<p className="text-xs leading-relaxed text-stone-200 line-clamp-4 select-text">
							{reasoning}
						</p>
					</div>
				) : (
					<button
						type="button"
						aria-label={`Why ${title} was recommended`}
						aria-expanded={false}
						className="inline-flex items-center gap-1.5 rounded-full bg-stone-950/85 hover:bg-stone-900 text-white border border-stone-700/70 backdrop-blur-md px-2.5 py-1 text-xs font-semibold shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer opacity-90 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							setShowReason(true);
						}}
					>
						<Sparkles size={12} className="text-primary shrink-0" />
						<span>Why?</span>
					</button>
				)}
			</div>
		);
	}

	if (usesCachedData) {
		const cardTitle = recommendation.verifiedTitle ?? title;
		return (
			<div className="relative group/rec-card">
				<MediaCard
					card_type="horizontal"
					id={recommendation.verifiedTmdbId as number}
					title={cardTitle}
					rating={recommendation.rating ?? 0}
					image={recommendation.posterPath ?? ""}
					poster_path={recommendation.posterPath ?? ""}
					media_type={mediaType}
					release_date={recommendation.releaseDate ?? null}
					overview={recommendation.overview ?? ""}
					relevanceScore={relevanceScore}
				/>
				<RecommendationReasoningOverlay
					reasoning={reasoning}
					title={cardTitle}
				/>
			</div>
		);
	}

	if (isStillLoading) {
		return <MediaCardSkeleton card_type="horizontal" />;
	}

	if (resolvedData) {
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
					relevanceScore={relevanceScore}
				/>
				<RecommendationReasoningOverlay
					reasoning={reasoning}
					title={resolvedData.title}
				/>
			</div>
		);
	}

	return (
		<div className="group/card w-40 md:w-44 lg:w-48">
			<Button
				type="button"
				variant="ghost"
				className="relative aspect-[2/3] h-auto w-full overflow-hidden rounded-xl bg-muted p-0 text-left ring-1 ring-border/40 transition-[box-shadow,border-color] duration-200 hover:bg-muted"
				onClick={() => navigate({ to: "/search", search: { query: title } })}
			>
				<div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-end p-2.5">
					<span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground capitalize">
						{mediaType === "movie" ? "Movie" : "TV"}
					</span>
				</div>

				<div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-1.5 p-3">
					<h3 className="text-[15px] font-bold leading-snug text-foreground line-clamp-2">
						{title}
					</h3>
					<p className="text-[10.5px] leading-relaxed text-muted-foreground line-clamp-3">
						{reasoning}
					</p>
					<div className="flex items-center justify-between mt-1 w-full">
						<span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground/50 transition-colors duration-200 group-hover/card:text-foreground">
							<ArrowUpRight size={11} />
							Search
						</span>
						{relevanceScore && (
							<span
								className={cn(
									"text-[10.5px] font-semibold",
									relevanceScore >= 80
										? "text-emerald-600 dark:text-emerald-400"
										: relevanceScore >= 60
											? "text-amber-600 dark:text-amber-400"
											: "text-muted-foreground",
								)}
							>
								{relevanceScore}% Match
							</span>
						)}
					</div>
				</div>
			</Button>
		</div>
	);
}
