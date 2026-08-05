export type MediaType = "movie" | "tv";

export type {
	SearchResults,
	SearchResultsEntity,
	MediaListResults,
	MediaListResultsEntity,
	Collection,
	PartsEntity,
	Genre,
	ProductionCompany,
	ProductionCountry,
	SpokenLanguage,
	CastMember,
	CrewMember,
	Credits,
	ImageAsset,
	LogoAsset,
	MediaImages,
	VideoResult,
	MediaVideosResultsEntity,
	MediaVideos,
	KeywordResult,
	BasicMovie,
	CollectionInfo,
	MovieExternalIds,
	MovieReleaseDates,
	ReleaseRegion,
	ReleaseInfo,
	MovieKeywords,
	Movie,
	BasicTv,
	Creator,
	EpisodeInfo,
	Network,
	SeasonInfo,
	TvExternalIds,
	TvRecommendations,
	RecommendationResult,
	TvKeywords,
	ContentRatings,
	ContentRatingsResultsEntity,
	Tv,
	MovieRecommendations,
	MovieRecommendationsResultsEntity,
	TvRecommendationsResultsEntity,
	BackdropsEntityOrPostersEntity,
	LogosEntity,
	MediaRecommendations,
	MediaRecommendationsResultsEntity,
	TvSeasonDetail,
	TvEpisodeDetail,
	PersonDetails,
	PersonResultCredits,
	PersonCreditCast,
	PersonCreditCrew,
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
