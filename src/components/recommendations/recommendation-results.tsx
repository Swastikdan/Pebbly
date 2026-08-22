import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
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

			<RecommendationCardGrid
				key={entry.id}
				entry={entry}
				updateVerified={updateVerified}
			/>
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

	if (usesCachedData) {
		return (
			<MediaCard
				card_type="horizontal"
				id={recommendation.verifiedTmdbId as number}
				title={recommendation.verifiedTitle ?? title}
				rating={recommendation.rating ?? 0}
				image={recommendation.posterPath ?? ""}
				poster_path={recommendation.posterPath ?? ""}
				media_type={mediaType}
				release_date={recommendation.releaseDate ?? null}
				overview={recommendation.overview ?? ""}
				relevanceScore={relevanceScore}
			/>
		);
	}

	if (isStillLoading) {
		return <MediaCardSkeleton card_type="horizontal" />;
	}

	if (resolvedData) {
		return (
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
