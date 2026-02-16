import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Star } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayerModal } from "@/components/video-player-modal";
import { IMAGE_PREFIX } from "@/constants";
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
	initialSeasonNumber,
}: InlineEpisodeBrowserProps) {
	// Filter out specials/season 0 by default, but keep them available
	const mainSeasons = seasons.filter((s) => s.season_number > 0);
	const specialSeasons = seasons.filter((s) => s.season_number === 0);
	const allSeasons = [...mainSeasons, ...specialSeasons];

	const [selectedSeason, setSelectedSeason] = useState(
		initialSeasonNumber ??
			mainSeasons[mainSeasons.length - 1]?.season_number ??
			1,
	);

	const { data: seasonData, isLoading } = useQuery({
		queryKey: ["tv_season_details", tvId, selectedSeason],
		queryFn: () => getTvSeasonDetails({ tvId, seasonNumber: selectedSeason }),
		enabled: !!tvId && selectedSeason >= 0,
	});

	const episodes = seasonData?.episodes ?? [];

	return (
		<div className="animate-fade-in-up pb-8">
			<div className="mb-5 flex items-end justify-between gap-4">
				<h2 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
					Episodes
				</h2>
				<span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
					{episodes.length} ep{episodes.length !== 1 ? "s" : ""}
				</span>
			</div>

			{/* Season Tabs */}
			<div className="scrollbar-hidden mb-6 flex gap-2 overflow-x-auto pb-1">
				{allSeasons.map((s) => (
					<button
						key={s.id}
						type="button"
						onClick={() => setSelectedSeason(s.season_number)}
						className={`pressable-small whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
							s.season_number === selectedSeason
								? "bg-foreground text-background shadow-md"
								: "bg-secondary/40 text-foreground/70 hover:bg-secondary/70 hover:text-foreground"
						}`}
					>
						{s.name}
					</button>
				))}
			</div>

			{/* Episodes List */}
			{isLoading ? (
				<div className="flex flex-col gap-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<div
							key={`ep-skel-${i}`}
							className="flex gap-4 rounded-2xl border border-default p-3"
						>
							<Skeleton className="h-24 w-40 shrink-0 rounded-xl" />
							<div className="flex flex-1 flex-col gap-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-5 w-48" />
								<Skeleton className="h-10 w-full" />
							</div>
						</div>
					))}
				</div>
			) : episodes.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					No episodes found for this season.
				</p>
			) : (
				<div className="stagger-grid flex flex-col gap-3">
					{episodes.map((episode) => (
						<EpisodeCard
							key={episode.id}
							episode={episode}
							showName={showName}
							tvId={tvId}
							seasonNumber={selectedSeason}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function EpisodeCard({
	episode,
	showName,
	tvId,
	seasonNumber,
}: {
	episode: TvEpisodeDetail;
	showName: string;
	tvId: number;
	seasonNumber: number;
}) {
	return (
		<div className="group relative overflow-hidden rounded-2xl border border-default bg-secondary/5 transition-all duration-300 hover:border-foreground/15 hover:bg-secondary/15 hover:shadow-md">
			<div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
				{/* Episode Still */}
				<div className="relative shrink-0 overflow-hidden rounded-xl">
					<Image
						alt={episode.name}
						className="h-28 w-full rounded-xl bg-foreground/10 object-cover sm:h-24 sm:w-40 md:h-28 md:w-48"
						height={160}
						src={
							episode.still_path
								? `${IMAGE_PREFIX.SD_BACKDROP}${episode.still_path}`
								: "https://placehold.co/500x281?text=No+Image"
						}
						width={280}
					/>
					{/* Play overlay */}
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
				<div className="flex flex-1 flex-col gap-1.5">
					<div className="flex items-start justify-between gap-2">
						<div className="flex flex-col gap-0.5">
							<span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
								E{String(episode.episode_number).padStart(2, "0")}
							</span>
							<h3 className="line-clamp-1 text-base font-bold md:text-lg">
								{episode.name}
							</h3>
						</div>
						<VideoPlayerModal
							tmdbId={tvId}
							type="tv"
							title={`${showName} - ${episode.name}`}
							season={seasonNumber}
							episode={episode.episode_number}
							variant="episode"
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2">
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
							<span className="font-mono text-[10px] tracking-wider text-muted-foreground">
								{new Date(episode.air_date).toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
									year: "numeric",
								})}
							</span>
						)}
						{episode.runtime && (
							<span className="font-mono text-[10px] tracking-wider text-muted-foreground">
								{episode.runtime}m
							</span>
						)}
					</div>

					<p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
						{episode.overview || "No overview available."}
					</p>
				</div>
			</div>
		</div>
	);
}
