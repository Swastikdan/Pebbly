import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Star } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayerModal } from "@/components/video-player-modal";
import { IMAGE_PREFIX } from "@/constants";
import {
	useEpisodeProgress,
	useEpisodeWatched,
} from "@/hooks/useWatchProgress";
import { getTvSeasonDetails } from "@/lib/queries";
import type { SeasonInfo, TvEpisodeDetail } from "@/types";

interface InlineEpisodeBrowserProps {
	tvId: number;
	showName: string;
	seasons: SeasonInfo[];
	initialSeasonNumber?: number;
}

export function InlineEpisodeBrowser({
	tvId,
	showName,
	seasons,
}: InlineEpisodeBrowserProps) {
	// Filter out specials/season 0 by default, but keep them available
	const mainSeasons = seasons.filter((s) => s.season_number > 0);
	const specialSeasons = seasons.filter((s) => s.season_number === 0);
	const allSeasons = [...mainSeasons, ...specialSeasons];

	const [showAllSeasons, setShowAllSeasons] = useState(false);
	const displayedSeasons = showAllSeasons ? allSeasons : allSeasons.slice(0, 3);
	const hasMoreSeasons = allSeasons.length > 3;

	const episodeTracker = useEpisodeWatched(tvId);

	return (
		<div className="animate-fade-in-up pb-8">
			<div className="mb-5 flex items-end justify-between gap-4">
				<h2 className=" text-2xl font-bold tracking-tight md:text-3xl">
					Episodes
				</h2>
			</div>

			{/* Accordion-based Season Browser */}
			<Accordion type="single" collapsible className="w-full space-y-2">
				{displayedSeasons.map((s) => {
					const seenAll = episodeTracker.isSeasonFullyWatched(
						s.season_number,
						s.episode_count,
					);
					const watchedCount = episodeTracker.getSeasonWatchedCount(
						s.season_number,
						s.episode_count,
					);

					return (
						<AccordionItem
							key={s.id}
							value={`season-${s.season_number}`}
							className="mb-3 rounded-xl border border-default/40 bg-card overflow-hidden"
						>
							<AccordionTrigger className="px-4 py-3.5 text-sm font-semibold hover:no-underline hover:bg-secondary/10 transition-colors [&[data-state=open]]:bg-secondary/10">
								<div className="flex items-center gap-3">
									<span className="text-base font-bold">
										{`Season ${s.season_number}`}
									</span>
									<Badge
										variant="secondary"
										className="rounded-md px-1.5 py-0.5 text-[10px]"
									>
										{s.episode_count} ep{s.episode_count !== 1 ? "s" : ""}
									</Badge>
									{s.air_date && (
										<span className="text-[10px] tracking-wider text-muted-foreground">
											{new Date(s.air_date).getFullYear()}
										</span>
									)}
									{seenAll && (
										<Badge
											variant="default"
											className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700 border border-emerald-500/25 dark:text-emerald-400"
										>
											✓ Seen
										</Badge>
									)}
									{!seenAll && watchedCount > 0 && (
										<span className="text-[10px] text-muted-foreground">
											{watchedCount}/{s.episode_count} watched
										</span>
									)}
								</div>
							</AccordionTrigger>
							<AccordionContent className="px-0 pb-0 border-t border-default/50">
								<SeasonEpisodeList
									tvId={tvId}
									showName={showName}
									seasonNumber={s.season_number}
									episodeTracker={episodeTracker}
									totalEpisodes={s.episode_count}
								/>
							</AccordionContent>
						</AccordionItem>
					);
				})}
			</Accordion>

			{!showAllSeasons && hasMoreSeasons && (
				<button
					type="button"
					onClick={() => setShowAllSeasons(true)}
					className="mt-3 w-full rounded-xl border border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:bg-secondary/5 hover:text-foreground transition-all"
				>
					View all {allSeasons.length} seasons
				</button>
			)}
		</div>
	);
}

function SeasonEpisodeList({
	tvId,
	showName,
	seasonNumber,
	episodeTracker,
	totalEpisodes,
}: {
	tvId: number;
	showName: string;
	seasonNumber: number;
	episodeTracker: ReturnType<typeof useEpisodeWatched>;
	totalEpisodes: number;
}) {
	const { data: seasonData, isLoading } = useQuery({
		queryKey: ["tv_season_details", tvId, seasonNumber],
		queryFn: () => getTvSeasonDetails({ tvId, seasonNumber }),
		enabled: !!tvId && seasonNumber >= 0,
	});

	const episodes = seasonData?.episodes ?? [];
	const seenAll = episodeTracker.isSeasonFullyWatched(
		seasonNumber,
		totalEpisodes,
	);

	const handleMarkAllSeen = useCallback(() => {
		const epNums = episodes.map((e) => e.episode_number);
		if (seenAll) {
			episodeTracker.unmarkSeasonWatched(seasonNumber, epNums);
		} else {
			episodeTracker.markSeasonWatched(seasonNumber, epNums);
		}
	}, [episodes, seenAll, seasonNumber, episodeTracker]);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-0 divide-y divide-border/50 px-4 pb-3">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={`ep-skel-${i}`} className="flex gap-4 py-3">
						<Skeleton className="h-20 w-36 shrink-0 rounded-xl" />
						<div className="flex flex-1 flex-col gap-2">
							<Skeleton className="h-3 w-16" />
							<Skeleton className="h-5 w-48" />
							<Skeleton className="h-8 w-full" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (episodes.length === 0) {
		return (
			<p className="py-8 text-center text-sm text-muted-foreground">
				No episodes found for this season.
			</p>
		);
	}

	return (
		<div className="flex flex-col divide-y divide-border/50">
			{/* Bulk action: Mark all as watched */}
			<div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border/30">
				<button
					type="button"
					onClick={handleMarkAllSeen}
					className="pressable-small text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
				>
					{seenAll ? "Unmark all as watched" : "Mark all as watched"}
				</button>
			</div>
			{episodes.map((episode) => (
				<EpisodeCard
					key={episode.id}
					episode={episode}
					showName={showName}
					tvId={tvId}
					seasonNumber={seasonNumber}
					isWatched={episodeTracker.isEpisodeWatched(
						seasonNumber,
						episode.episode_number,
					)}
					onToggleWatched={() =>
						episodeTracker.toggleEpisodeWatched(
							seasonNumber,
							episode.episode_number,
						)
					}
				/>
			))}
		</div>
	);
}

function EpisodeCard({
	episode,
	showName,
	tvId,
	seasonNumber,
	isWatched,
	onToggleWatched,
}: {
	episode: TvEpisodeDetail;
	showName: string;
	tvId: number;
	seasonNumber: number;
	isWatched: boolean;
	onToggleWatched: () => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const hasLongOverview = (episode.overview?.length ?? 0) > 120;
	const progress = useEpisodeProgress(
		tvId,
		seasonNumber,
		episode.episode_number,
	);

	return (
		<div
			className={`group relative flex flex-row items-start gap-3 px-4 py-3 transition-colors duration-200 hover:bg-secondary/8 ${isWatched ? "opacity-60" : ""}`}
		>
			{/* Episode Still with hover play icon */}
			<div className="relative shrink-0 overflow-hidden rounded-xl">
				<Image
					alt={episode.name}
					className={`h-20 w-32 rounded-xl bg-foreground/10 object-cover xs:h-24 xs:w-40 sm:w-44 md:h-28 md:w-48 ${isWatched ? "saturate-50" : ""}`}
					height={140}
					src={
						episode.still_path
							? `${IMAGE_PREFIX.SD_BACKDROP}${episode.still_path}`
							: "https://placehold.co/500x281?text=No+Image"
					}
					width={250}
				/>
				{/* Subtle hover play icon overlay */}
				<VideoPlayerModal
					tmdbId={tvId}
					type="tv"
					title={`${showName} - ${episode.name}`}
					season={seasonNumber}
					episode={episode.episode_number}
					variant="card"
				/>
			</div>

			{/* Info */}
			<div className="flex flex-1 flex-col gap-1">
				<div className="flex items-start justify-between gap-2">
					<div className="flex flex-col gap-0.5 min-w-0">
						<span className="text-[10px] tracking-widest text-muted-foreground uppercase">
							E{String(episode.episode_number).padStart(2, "0")}
						</span>
						{/* Full title — no truncation */}
						<h3
							className={`text-sm font-bold md:text-base truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none ${isWatched ? "text-muted-foreground" : ""}`}
						>
							{episode.name}
						</h3>
					</div>

					{/* Mark as watched toggle */}
					<button
						type="button"
						onClick={onToggleWatched}
						className={`pressable-small shrink-0 rounded-lg border p-1.5 text-[10px] font-medium transition-all ${
							isWatched
								? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
								: "border-border/50 bg-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground"
						}`}
						title={isWatched ? "Mark as unwatched" : "Mark as watched"}
					>
						{isWatched ? (
							<svg
								className="size-3.5"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={2.5}
								stroke="currentColor"
							>
								<title>Mark as unwatched</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M4.5 12.75l6 6 9-13.5"
								/>
							</svg>
						) : (
							<svg
								className="size-3.5"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={2}
								stroke="currentColor"
							>
								<title>Mark as watched</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
						)}
					</button>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{isWatched && (
						<Badge
							variant="default"
							className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700 border border-emerald-500/25 dark:text-emerald-400"
						>
							Seen
						</Badge>
					)}
					{!isWatched && progress > 0 && (
						<Badge
							variant="secondary"
							className="rounded-md border border-amber-500/25 bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500 dark:text-amber-400"
						>
							{Math.round(progress)}%
						</Badge>
					)}
					{episode.vote_average > 0 && (
						<Badge
							className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
							variant="secondary"
						>
							<Star className="mr-0.5 size-2.5 fill-current text-yellow-400" />
							{episode.vote_average.toFixed(1)}
						</Badge>
					)}
					{episode.air_date && (
						<span className="text-[10px] tracking-wider text-muted-foreground">
							{new Date(episode.air_date).toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>
					)}
					{episode.runtime && (
						<span className="text-[10px] tracking-wider text-muted-foreground">
							{episode.runtime}m
						</span>
					)}
				</div>

				{/* Description with Read More toggle */}
				{episode.overview ? (
					<div className="mt-0.5 hidden sm:block">
						<p className="text-xs leading-relaxed text-muted-foreground">
							{expanded || !hasLongOverview
								? episode.overview
								: `${episode.overview.slice(0, 120)}…`}
						</p>
						{hasLongOverview && (
							<button
								type="button"
								onClick={() => setExpanded(!expanded)}
								className="mt-0.5 text-[11px] font-medium text-foreground/60 hover:text-foreground transition-colors"
							>
								{expanded ? "Show less" : "Read more"}
							</button>
						)}
					</div>
				) : (
					<p className="text-xs text-muted-foreground/60 italic">
						No overview available.
					</p>
				)}
			</div>
		</div>
	);
}
