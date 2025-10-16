import { GoBack } from "@/components/go-back";
import { RatingCount } from "@/components/media/rating-count";
import { ShareButton } from "@/components/share-button";
import { WatchlistButton } from "@/components/watchlist-button";

export const MediaTitleContailer = (props: {
	title: string;
	rateing: number;
	image: string;
	poster_path: string;
	id: number;
	media_type: "movie" | "tv";
	release_date: string | null;
	description: string;
	tagline: string | null;
	releaseyear: string;
	uscertification: string;
	runtime?: string | null;
	vote_average: number | null;
	vote_count: number | null;
	imdb_url?: string | null;
	tv_status?: string | null;
}) => {
	const {
		id,
		title,
		rateing,
		poster_path,
		media_type,
		release_date,
		tagline,
		releaseyear,
		uscertification,
		runtime,
		vote_average,
		vote_count,
		imdb_url,
		tv_status,
	} = props;

	return (
		<div className="pt-5 pb-5">
			<div className="space-y-3 pb-5">
				<div className="flex items-center justify-between">
					<GoBack link="/" title="Go to Home" />
					<div className="flex items-center gap-3">
						<WatchlistButton
							id={id}
							image={poster_path}
							is_on_homepage={true}
							media_type={media_type}
							rating={rateing}
							release_date={release_date ?? ""}
							title={title}
						/>
						<ShareButton title={title} />
					</div>
				</div>
				<h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
					{imdb_url ? (
						<a
							className="hover:text-foreground hover:opacity-70"
							href={imdb_url}
							rel="noopener noreferrer"
							target="_blank"
						>
							{title}
						</a>
					) : (
						title
					)}
				</h1>
				{tagline && <h2 className="hidden sm:flex">{tagline}</h2>}
			</div>
			<div className="flex flex-col items-start justify-start space-y-3 sm:flex-row sm:items-center sm:justify-between">
				<span className="space-x-1 font-light whitespace-nowrap">
					{releaseyear && releaseyear !== "null" && (
						<>
							<span className="py-1">{releaseyear}</span>
							<span className="py-1">•</span>
						</>
					)}

					<span className="ring-ring rounded-md px-2 py-1 ring-1">
						{uscertification}
					</span>
					{runtime && (
						<>
							<span className="py-1">•</span>
							<span className="py-1">{runtime}</span>
						</>
					)}
					{tv_status && (
						<>
							<span className="py-1">•</span>
							<span className="py-1">{tv_status}</span>
						</>
					)}
				</span>
				<div className="hidden sm:flex">
					<RatingCount
						rating={parseInt(vote_average?.toFixed(1) ?? "0", 10)}
						ratingcount={vote_count ?? 0}
					/>
				</div>
			</div>
		</div>
	);
};
