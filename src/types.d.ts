export type MediaType = "movie" | "tv";

export type {
	BackdropsEntityOrPostersEntity,
	BasicMovie,
	BasicTv,
	CastMember,
	Collection,
	CollectionInfo,
	ContentRatings,
	ContentRatingsResultsEntity,
	Creator,
	Credits,
	CrewMember,
	EpisodeInfo,
	Genre,
	ImageAsset,
	KeywordResult,
	LogoAsset,
	LogosEntity,
	MediaImages,
	MediaListResults,
	MediaListResultsEntity,
	MediaRecommendations,
	MediaRecommendationsResultsEntity,
	MediaVideos,
	MediaVideosResultsEntity,
	Movie,
	MovieExternalIds,
	MovieKeywords,
	MovieRecommendations,
	MovieRecommendationsResultsEntity,
	MovieReleaseDates,
	Network,
	PartsEntity,
	PersonCreditCast,
	PersonCreditCrew,
	PersonDetails,
	PersonResultCredits,
	ProductionCompany,
	ProductionCountry,
	RecommendationResult,
	ReleaseInfo,
	ReleaseRegion,
	SearchResults,
	SearchResultsEntity,
	SeasonInfo,
	SpokenLanguage,
	Tv,
	TvEpisodeDetail,
	TvExternalIds,
	TvKeywords,
	TvRecommendations,
	TvRecommendationsResultsEntity,
	TvSeasonDetail,
	VideoResult,
} from "@/lib/tmdb-schemas";

export interface MediaQuery {
	type:
		| "trending_day"
		| "trending_week"
		| "movies_upcoming"
		| "movies_popular"
		| "tv-shows_popular"
		| "movies_top-rated"
		| "tv-shows_top-rated";
	page?: number;
}

export interface MediaListQuery {
	type:
		| "movies_popular"
		| "movies_now-playing"
		| "movies_top-rated"
		| "movies_upcoming"
		| "tv-shows_popular"
		| "tv-shows_on-the-air"
		| "tv-shows_top-rated"
		| "tv-shows_airing-today";

	page: number;
}

export type ProgressStatus = "watch-later" | "watching" | "done" | "dropped";

export type ReactionStatus =
	| "loved"
	| "liked"
	| "mixed"
	| "not-for-me"
	| "recommended";

export interface AIRecommendation {
	title: string;
	tmdbId: number | null;
	mediaType: "movie" | "tv";
	relevanceScore: number;
	reasoning: string;
	verifiedTmdbId?: number | null;
	verifiedTitle?: string;
	posterPath?: string | null;
	rating?: number;
	releaseDate?: string | null;
	overview?: string;
}
