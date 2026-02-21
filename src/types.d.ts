export type MediaType = "movie" | "tv";

export interface SearchResults {
	page: number;
	results?: SearchResultsEntity[] | null;
	total_pages: number;
	total_results: number;
}
export interface SearchResultsEntity {
	backdrop_path?: string | null;
	id: number;
	name?: string | null;
	original_name?: string | null;
	overview?: string | null;
	poster_path?: string | null;
	media_type: string;
	adult: boolean;
	original_language?: string | null;
	genre_ids?: (number | null)[] | null;
	popularity: number;
	first_air_date?: string | null;
	vote_average?: number | null;
	vote_count?: number | null;
	origin_country?: string[] | null;
	title?: string | null;
	original_title?: string | null;
	release_date?: string | null;
	video?: boolean | null;
	gender?: number | null;
	known_for_department?: null;
	profile_path?: null;
	known_for?: null[] | null;
}

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

export interface MediaListResults {
	page: number;
	results?: MediaListResultsEntity[] | null;
	total_pages: number;
	total_results: number;
}
export interface MediaListResultsEntity {
	adult: boolean;
	backdrop_path: string;
	genre_ids?: number[] | null;
	id: number;
	original_language: string;
	original_title?: string;
	original_name?: string;
	overview: string;
	popularity: number;
	poster_path: string;
	release_date?: string;
	first_air_date?: sting;
	media_type?: string;
	title?: string;
	name?: string;
	video: boolean;
	vote_average: number;
	vote_count: number;
	known_for_department?: string;
}

export interface Collection {
	id: number;
	name: string;
	overview: string;
	poster_path: string;
	backdrop_path: string;
	parts?: PartsEntity[] | null;
}
export interface PartsEntity {
	backdrop_path: string;
	id: number;
	title: string;
	original_title: string;
	overview: string;
	poster_path: string;
	media_type: string;
	adult: boolean;
	original_language: string;
	genre_ids?: number[] | null;
	popularity: number;
	release_date: string;
	video: boolean;
	vote_average: number;
	vote_count: number;
}
// Shared interfaces used by both Movies and TV Shows
export interface Genre {
	id: number;
	name: string;
}

export interface ProductionCompany {
	id: number;
	logo_path?: string | null;
	name: string;
	origin_country: string;
}

export interface ProductionCountry {
	iso_3166_1: string;
	name: string;
}

export interface SpokenLanguage {
	english_name: string;
	iso_639_1: string;
	name: string;
}

export interface CastMember {
	adult: boolean;
	gender: number;
	id: number;
	known_for_department: string;
	name: string;
	original_name: string;
	popularity: number;
	profile_path?: string;
	cast_id?: number;
	character: string;
	credit_id: string;
	order: number;
}

export interface CrewMember {
	adult: boolean;
	gender: number;
	id: number;
	known_for_department: string;
	name: string;
	original_name: string;
	popularity: number;
	profile_path?: string;
	credit_id: string;
	department: string;
	job: string;
}

export interface Credits {
	cast?: CastMember[] | null;
	crew?: CrewMember[] | null;
}

export interface ImageAsset {
	aspect_ratio: number;
	height: number;
	iso_639_1?: string | null;
	file_path: string;
	vote_average: number;
	vote_count: number;
	width: number;
}

export interface LogoAsset {
	aspect_ratio: number;
	height: number;
	iso_639_1: string;
	file_path: string;
	vote_average: number;
	vote_count: number;
	width: number;
}

export interface MediaImages {
	backdrops?: ImageAsset[] | null;
	logos?: LogoAsset[] | null;
	posters?: ImageAsset[] | null;
}

export interface VideoResult {
	iso_639_1: string;
	iso_3166_1: string;
	name: string;
	key: string;
	site: string;
	size: number;
	type: string;
	official: boolean;
	published_at: string;
	id: string;
}

export interface MediaVideos {
	results?: VideoResult[] | null;
}

export interface KeywordResult {
	id: number;
	name: string;
}

// Movie-specific interfaces
export interface BasicMovie {
	adult: boolean;
	backdrop_path: string;
	belongs_to_collection: CollectionInfo;
	budget: number;
	genres?: Genre[] | null;
	homepage: string;
	id: number;
	imdb_id: string;
	origin_country?: string[] | null;
	original_language: string;
	original_title: string;
	overview: string;
	popularity: number;
	poster_path: string;
	production_companies?: ProductionCompany[] | null;
	production_countries?: ProductionCountry[] | null;
	release_date: string;
	revenue: number;
	runtime: number;
	spoken_languages?: SpokenLanguage[] | null;
	status: string;
	tagline: string;
	title: string;
	video: boolean;
	vote_average: number;
	vote_count: number;
}

export interface CollectionInfo {
	id: number;
	name: string;
	poster_path: string;
	backdrop_path: string;
}

export interface MovieExternalIds {
	imdb_id: string;
	wikidata_id: string;
	facebook_id: string;
	instagram_id: string;
	twitter_id: string;
}

export interface MovieReleaseDates {
	results?: ReleaseRegion[] | null;
}

export interface ReleaseRegion {
	iso_3166_1: string;
	release_dates?: ReleaseInfo[] | null;
}

export interface ReleaseInfo {
	certification: string;
	descriptors?: (string | null)[] | null;
	iso_639_1: string;
	note: string;
	release_date: string;
	type: number;
}

export interface MovieKeywords {
	keywords?: KeywordResult[] | null;
}

export interface Movie {
	adult: boolean;
	backdrop_path: string;
	belongs_to_collection: CollectionInfo;
	budget: number;
	genres?: Genre[] | null;
	homepage: string;
	id: number;
	imdb_id: string;
	origin_country?: string[] | null;
	original_language: string;
	original_title: string;
	overview: string;
	popularity: number;
	poster_path: string;
	production_companies?: ProductionCompany[] | null;
	production_countries?: ProductionCountry[] | null;
	release_date: string;
	revenue: number;
	runtime: number;
	spoken_languages?: SpokenLanguage[] | null;
	status: string;
	tagline: string;
	title: string;
	video: boolean;
	vote_average: number;
	vote_count: number;
	external_ids: MovieExternalIds;
	images: MediaImages;
	credits: Credits;
	videos: MediaVideos;
	release_dates: MovieReleaseDates;
	keywords: MovieKeywords;
}

// TV-specific interfaces
export interface BasicTv {
	adult: boolean;
	backdrop_path: string;
	created_by?: Creator[] | null;
	episode_run_time?: null[] | null;
	first_air_date: string;
	genres?: Genre[] | null;
	homepage: string;
	id: number;
	in_production: boolean;
	languages?: string[] | null;
	last_air_date: string;
	last_episode_to_air: EpisodeInfo;
	name: string;
	next_episode_to_air?: null;
	networks?: Network[] | null;
	number_of_episodes: number;
	number_of_seasons: number;
	origin_country?: string[] | null;
	original_language: string;
	original_name: string;
	overview: string;
	popularity: number;
	poster_path: string;
	production_companies?: ProductionCompany[] | null;
	production_countries?: ProductionCountry[] | null;
	seasons?: SeasonInfo[] | null;
	spoken_languages?: SpokenLanguage[] | null;
	status: string;
	tagline: string;
	type: string;
	vote_average: number;
	vote_count: number;
}

export interface Creator {
	id: number;
	credit_id: string;
	name: string;
	original_name: string;
	gender: number;
	profile_path: string;
}

export interface EpisodeInfo {
	id: number;
	name: string;
	overview: string;
	vote_average: number;
	vote_count: number;
	air_date: string;
	episode_number: number;
	episode_type: string;
	production_code: string;
	runtime: number;
	season_number: number;
	show_id: number;
	still_path: string;
}

export interface Network {
	id: number;
	logo_path: string;
	name: string;
	origin_country: string;
}

export interface SeasonInfo {
	air_date: string;
	episode_count: number;
	id: number;
	name: string;
	overview: string;
	poster_path: string;
	season_number: number;
	vote_average: number;
}

export interface TvExternalIds {
	imdb_id: string;
	freebase_mid: string;
	freebase_id: string;
	tvdb_id: number;
	tvrage_id: number;
	wikidata_id: string;
	facebook_id: string;
	instagram_id: string;
	twitter_id: string;
}

export interface TvRecommendations {
	page: number;
	results?: RecommendationResult[] | null;
	total_pages: number;
	total_results: number;
}

export interface RecommendationResult {
	backdrop_path: string;
	id: number;
	name: string;
	original_name: string;
	overview: string;
	poster_path: string;
	media_type: string;
	adult: boolean;
	original_language: string;
	genre_ids?: number[] | null;
	popularity: number;
	first_air_date: string;
	vote_average: number;
	vote_count: number;
	origin_country?: string[] | null;
}

export interface TvKeywords {
	results?: KeywordResult[] | null;
}
export interface ContentRatings {
	results?: ContentRatingsResultsEntity[] | null;
}
export interface ContentRatingsResultsEntity {
	descriptors?: null[] | null;
	iso_3166_1: string;
	rating: string;
}
export interface Tv {
	adult: boolean;
	backdrop_path: string;
	created_by?: Creator[] | null;
	episode_run_time?: null[] | null;
	first_air_date: string;
	genres?: Genre[] | null;
	homepage: string;
	id: number;
	in_production: boolean;
	languages?: string[] | null;
	last_air_date: string;
	last_episode_to_air: EpisodeInfo;
	name: string;
	next_episode_to_air?: null;
	networks?: Network[] | null;
	number_of_episodes: number;
	number_of_seasons: number;
	origin_country?: string[] | null;
	original_language: string;
	original_name: string;
	overview: string;
	popularity: number;
	poster_path: string;
	production_companies?: ProductionCompany[] | null;
	production_countries?: ProductionCountry[] | null;
	seasons?: SeasonInfo[] | null;
	spoken_languages?: SpokenLanguage[] | null;
	status: string;
	tagline: string;
	type: string;
	vote_average: number;
	vote_count: number;
	external_ids: TvExternalIds;
	images: MediaImages;
	credits: Credits;
	videos: MediaVideos;
	recommendations: TvRecommendations;
	keywords: TvKeywords;
	content_ratings: ContentRatings;
}

export interface MovieRecommendations {
	page: number;
	results?: MovieRecommendationsResultsEntity[] | null;
	total_pages: number;
	total_results: number;
}
export interface MovieRecommendationsResultsEntity {
	backdrop_path: string;
	id: number;
	title: string;
	original_title: string;
	overview: string;
	poster_path: string;
	media_type: string;
	adult: boolean;
	original_language: string;
	genre_ids?: number[] | null;
	popularity: number;
	release_date: string;
	video: boolean;
	vote_average: number;
	vote_count: number;
}

export interface TvRecommendations {
	page: number;
	results?: TvRecommendationsResultsEntity[] | null;
	total_pages: number;
	total_results: number;
}
export interface TvRecommendationsResultsEntity {
	backdrop_path: string;
	id: number;
	name: string;
	original_name: string;
	overview: string;
	poster_path: string;
	media_type: string;
	adult: boolean;
	original_language: string;
	genre_ids?: number[] | null;
	popularity: number;
	first_air_date: string;
	vote_average: number;
	vote_count: number;
	origin_country?: string[] | null;
}

export interface MediaImages {
	backdrops?: BackdropsEntityOrPostersEntity[] | null;
	id: number;
	logos?: LogosEntity[] | null;
	posters?: BackdropsEntityOrPostersEntity[] | null;
}
export interface BackdropsEntityOrPostersEntity {
	aspect_ratio: number;
	height: number;
	iso_639_1?: string | null;
	file_path: string;
	vote_average: number;
	vote_count: number;
	width: number;
}
export interface LogosEntity {
	aspect_ratio: number;
	height: number;
	iso_639_1: string;
	file_path: string;
	vote_average: number;
	vote_count: number;
	width: number;
}

export interface MediaVideos {
	id: number;
	results?: MediaVideosResultsEntity[] | null;
}
export interface MediaVideosResultsEntity {
	iso_639_1: string;
	iso_3166_1: string;
	name: string;
	key: string;
	site: string;
	size: number;
	type: string;
	official: boolean;
	published_at: string;
	id: string;
}
export interface MediaRecommendations {
	page: number;
	results?: MediaRecommendationsResultsEntity[] | null;
	total_pages: number;
	total_results: number;
}
export interface MediaRecommendationsResultsEntity {
	backdrop_path: string;
	id: number;
	title?: string;
	name?: string;
	original_title?: string;
	original_name?: string;
	overview: string;
	poster_path: string;
	media_type: string;
	adult: boolean;
	original_language: string;
	genre_ids?: number[] | null;
	popularity: number;
	release_date?: string;
	first_air_date?: string;
	video: boolean;
	vote_average: number;
	vote_count: number;
}

// TV Season Detail (from /tv/{id}/season/{season_number})
export interface TvSeasonDetail {
	_id: string;
	air_date: string;
	episodes: TvEpisodeDetail[];
	name: string;
	overview: string;
	id: number;
	poster_path: string;
	season_number: number;
	vote_average: number;
}

export interface TvEpisodeDetail {
	air_date: string;
	episode_number: number;
	episode_type: string;
	id: number;
	name: string;
	overview: string;
	production_code: string;
	runtime: number | null;
	season_number: number;
	show_id: number;
	still_path: string | null;
	vote_average: number;
	vote_count: number;
	crew?: CrewMember[] | null;
	guest_stars?: CastMember[] | null;
}

export type ProgressStatus =
	| "want-to-watch"
	| "watching"
	| "finished"
	| "dropped";

export type ReactionStatus = "loved" | "liked" | "mixed" | "not-for-me";

// Legacy combined status kept for compatibility during rollout.
export type WatchlistStatus =
	| "plan-to-watch"
	| "watching"
	| "completed"
	| "liked"
	| "dropped";

// Person Specific Interfaces
export interface PersonDetails {
	adult: boolean;
	also_known_as: string[];
	biography: string;
	birthday: string | null;
	deathday: string | null;
	gender: number;
	homepage: string | null;
	id: number;
	imdb_id: string;
	known_for_department: string;
	name: string;
	place_of_birth: string | null;
	popularity: number;
	profile_path: string | null;
	movie_credits: PersonResultCredits;
	tv_credits: PersonResultCredits;
	images: { profiles: ImageAsset[] };
	external_ids: {
		imdb_id?: string;
		facebook_id?: string;
		instagram_id?: string;
		twitter_id?: string;
		tiktok_id?: string;
		youtube_id?: string;
	};
}

export interface PersonResultCredits {
	cast: PersonCreditCast[];
	crew: PersonCreditCrew[];
}

export interface PersonCreditCast {
	adult: boolean;
	backdrop_path: string | null;
	genre_ids: number[];
	id: number;
	original_language: string;
	original_title?: string;
	original_name?: string;
	overview: string;
	popularity: number;
	poster_path: string | null;
	release_date?: string;
	first_air_date?: string;
	title?: string;
	name?: string;
	video?: boolean;
	vote_average: number;
	vote_count: number;
	character: string;
	credit_id: string;
	order?: number;
	media_type: "movie" | "tv";
	episode_count?: number;
}

export interface PersonCreditCrew {
	adult: boolean;
	backdrop_path: string | null;
	genre_ids: number[];
	id: number;
	original_language: string;
	original_title?: string;
	original_name?: string;
	overview: string;
	popularity: number;
	poster_path: string | null;
	release_date?: string;
	first_air_date?: string;
	title?: string;
	name?: string;
	video?: boolean;
	vote_average: number;
	vote_count: number;
	credit_id: string;
	department: string;
	job: string;
	media_type: "movie" | "tv";
	episode_count?: number;
}
