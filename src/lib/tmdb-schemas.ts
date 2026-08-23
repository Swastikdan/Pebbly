import * as v from "valibot";

/*
 * Valibot Schemas for TMDB API Responses
 *
 * Resilient schema validation for TMDB API endpoints.
 * TMDB frequently returns null or omits fields (e.g. character, poster_path, biography).
 * Using v.fallback guarantees that null, undefined, or missing fields gracefully
 * fall back to clean default values (e.g. "", 0, false, null) without throwing
 * runtime validation errors or breaking TypeScript types.
 */

// Resilient field primitives using v.fallback and v.transform
const str = (fallback = "") => v.fallback(v.string(), fallback);
const strNull = () => v.fallback(v.nullable(v.string()), null);
const strOpt = () =>
	v.optional(
		v.pipe(
			v.nullable(v.string()),
			v.transform((val) => val ?? undefined),
		),
	);
const num = (fallback = 0) => v.fallback(v.number(), fallback);
const numNull = () => v.fallback(v.nullable(v.number()), null);
const numOpt = () =>
	v.optional(
		v.pipe(
			v.nullable(v.number()),
			v.transform((val) => val ?? undefined),
		),
	);
const bool = (fallback = false) => v.fallback(v.boolean(), fallback);

export const GenreSchema = v.looseObject({
	id: v.number(),
	name: str(),
});
export type Genre = v.InferOutput<typeof GenreSchema>;

export const ProductionCompanySchema = v.looseObject({
	id: v.number(),
	logo_path: strNull(),
	name: str(),
	origin_country: str(),
});
export type ProductionCompany = v.InferOutput<typeof ProductionCompanySchema>;

export const ProductionCountrySchema = v.looseObject({
	iso_3166_1: str(),
	name: str(),
});
export type ProductionCountry = v.InferOutput<typeof ProductionCountrySchema>;

export const SpokenLanguageSchema = v.looseObject({
	english_name: str(),
	iso_639_1: str(),
	name: str(),
});
export type SpokenLanguage = v.InferOutput<typeof SpokenLanguageSchema>;

export const CastMemberSchema = v.looseObject({
	adult: bool(),
	gender: num(),
	id: v.number(),
	known_for_department: str(),
	name: str(),
	original_name: str(),
	popularity: num(),
	profile_path: strNull(),
	cast_id: numNull(),
	character: str(),
	credit_id: str(),
	order: num(),
});
export type CastMember = v.InferOutput<typeof CastMemberSchema>;

export const CrewMemberSchema = v.looseObject({
	adult: bool(),
	gender: num(),
	id: v.number(),
	known_for_department: str(),
	name: str(),
	original_name: str(),
	popularity: num(),
	profile_path: strNull(),
	credit_id: str(),
	department: str(),
	job: str(),
});
export type CrewMember = v.InferOutput<typeof CrewMemberSchema>;

export const CreditsSchema = v.looseObject({
	cast: v.nullish(v.array(CastMemberSchema), () => []),
	crew: v.nullish(v.array(CrewMemberSchema), () => []),
});
export type Credits = v.InferOutput<typeof CreditsSchema>;

export const ImageAssetSchema = v.looseObject({
	aspect_ratio: num(),
	height: num(),
	iso_639_1: strNull(),
	file_path: str(),
	vote_average: num(),
	vote_count: num(),
	width: num(),
});
export type ImageAsset = v.InferOutput<typeof ImageAssetSchema>;

export const MediaImagesSchema = v.looseObject({
	id: numNull(),
	backdrops: v.nullish(v.array(ImageAssetSchema), () => []),
	logos: v.nullish(v.array(ImageAssetSchema), () => []),
	posters: v.nullish(v.array(ImageAssetSchema), () => []),
});
export type MediaImages = v.InferOutput<typeof MediaImagesSchema>;

export const VideoResultSchema = v.looseObject({
	iso_639_1: str(),
	iso_3166_1: str(),
	name: str(),
	key: str(),
	site: str(),
	size: num(),
	type: str(),
	official: bool(),
	published_at: str(),
	id: str(),
});
export type VideoResult = v.InferOutput<typeof VideoResultSchema>;

export const MediaVideosResultsEntitySchema = VideoResultSchema;
export type MediaVideosResultsEntity = v.InferOutput<
	typeof MediaVideosResultsEntitySchema
>;

/*
 * Standard TMDB paged envelope (page / results / total_pages / total_results)
 * shared by every list-shaped endpoint response.
 */
const paginated = <S extends v.GenericSchema>(item: S) =>
	v.looseObject({
		page: num(1),
		results: v.nullish(v.array(item), () => []),
		total_pages: num(1),
		total_results: num(0),
	});

export const MediaVideosSchema = v.looseObject({
	id: numNull(),
	results: v.fallback(v.nullable(v.array(VideoResultSchema)), []),
});
export type MediaVideos = v.InferOutput<typeof MediaVideosSchema>;

export const KeywordResultSchema = v.looseObject({
	id: v.number(),
	name: str(),
});
export type KeywordResult = v.InferOutput<typeof KeywordResultSchema>;

export const CollectionInfoSchema = v.looseObject({
	id: v.number(),
	name: str(),
	poster_path: strNull(),
	backdrop_path: strNull(),
});
export type CollectionInfo = v.InferOutput<typeof CollectionInfoSchema>;

export const PartsEntitySchema = v.looseObject({
	backdrop_path: strNull(),
	id: v.number(),
	title: str(),
	original_title: str(),
	overview: str(),
	poster_path: strNull(),
	media_type: str("movie"),
	adult: bool(),
	original_language: str(),
	genre_ids: v.fallback(v.nullable(v.array(v.number())), []),
	popularity: num(),
	release_date: strNull(),
	video: bool(),
	vote_average: num(),
	vote_count: num(),
});
export type PartsEntity = v.InferOutput<typeof PartsEntitySchema>;

export const CollectionSchema = v.looseObject({
	id: v.number(),
	name: str(),
	overview: str(),
	poster_path: strNull(),
	backdrop_path: strNull(),
	parts: v.fallback(v.nullable(v.array(PartsEntitySchema)), []),
});
export type Collection = v.InferOutput<typeof CollectionSchema>;

export const SearchResultsEntitySchema = v.looseObject({
	backdrop_path: strNull(),
	id: v.number(),
	name: strNull(),
	original_name: strNull(),
	overview: strNull(),
	poster_path: strNull(),
	media_type: str("movie"),
	adult: bool(),
	original_language: strNull(),
	genre_ids: v.fallback(v.nullable(v.array(v.nullable(v.number()))), []),
	popularity: num(),
	first_air_date: strNull(),
	vote_average: numNull(),
	vote_count: numNull(),
	origin_country: v.fallback(v.nullable(v.array(v.string())), []),
	title: strNull(),
	original_title: strNull(),
	release_date: strNull(),
	video: bool(),
	gender: numNull(),
	known_for_department: strNull(),
	profile_path: strNull(),
	known_for: v.fallback(v.nullable(v.array(v.unknown())), []),
});
export type SearchResultsEntity = v.InferOutput<
	typeof SearchResultsEntitySchema
>;

export const SearchResultsSchema = paginated(SearchResultsEntitySchema);
export type SearchResults = v.InferOutput<typeof SearchResultsSchema>;

export const MediaListResultsEntitySchema = v.looseObject({
	adult: bool(),
	backdrop_path: strNull(),
	genre_ids: v.optional(v.fallback(v.nullable(v.array(v.number())), null)),
	id: v.number(),
	original_language: str(),
	original_title: strOpt(),
	original_name: strOpt(),
	overview: str(),
	popularity: num(),
	poster_path: strNull(),
	release_date: strOpt(),
	first_air_date: strOpt(),
	media_type: strOpt(),
	title: strOpt(),
	name: strOpt(),
	video: bool(),
	vote_average: num(),
	vote_count: num(),
	known_for_department: strOpt(),
});
export type MediaListResultsEntity = v.InferOutput<
	typeof MediaListResultsEntitySchema
>;

export const MediaListResultsSchema = v.looseObject({
	page: num(1),
	results: v.fallback(v.nullable(v.array(MediaListResultsEntitySchema)), []),
	total_pages: num(1),
	total_results: num(0),
});
export type MediaListResults = v.InferOutput<typeof MediaListResultsSchema>;

export const MovieExternalIdsSchema = v.looseObject({
	imdb_id: strNull(),
	wikidata_id: strNull(),
	facebook_id: strNull(),
	instagram_id: strNull(),
	twitter_id: strNull(),
});
export type MovieExternalIds = v.InferOutput<typeof MovieExternalIdsSchema>;

export const ReleaseInfoSchema = v.looseObject({
	certification: str(),
	descriptors: v.fallback(v.nullable(v.array(v.nullable(v.string()))), []),
	iso_639_1: str(),
	note: str(),
	release_date: str(),
	type: num(),
});
export type ReleaseInfo = v.InferOutput<typeof ReleaseInfoSchema>;

export const ReleaseRegionSchema = v.looseObject({
	iso_3166_1: str(),
	release_dates: v.fallback(v.nullable(v.array(ReleaseInfoSchema)), []),
});
export type ReleaseRegion = v.InferOutput<typeof ReleaseRegionSchema>;

export const MovieReleaseDatesSchema = v.looseObject({
	results: v.fallback(v.nullable(v.array(ReleaseRegionSchema)), []),
});
export type MovieReleaseDates = v.InferOutput<typeof MovieReleaseDatesSchema>;

export const MovieKeywordsSchema = v.looseObject({
	keywords: v.fallback(v.nullable(v.array(KeywordResultSchema)), []),
});
export type MovieKeywords = v.InferOutput<typeof MovieKeywordsSchema>;

export const BasicMovieSchema = v.looseObject({
	adult: bool(),
	backdrop_path: strNull(),
	belongs_to_collection: v.nullable(CollectionInfoSchema),
	budget: num(),
	genres: v.nullish(v.array(GenreSchema), () => []),
	homepage: strNull(),
	id: v.number(),
	imdb_id: strNull(),
	origin_country: v.nullish(v.array(v.string()), () => []),
	original_language: str(),
	original_title: str(),
	overview: str(),
	popularity: num(),
	poster_path: strNull(),
	production_companies: v.nullish(v.array(ProductionCompanySchema), () => []),
	production_countries: v.nullish(v.array(ProductionCountrySchema), () => []),
	release_date: str(),
	revenue: num(),
	runtime: numOpt(),
	spoken_languages: v.nullish(v.array(SpokenLanguageSchema), () => []),
	status: str(),
	tagline: strNull(),
	title: str(),
	video: bool(),
	vote_average: num(),
	vote_count: num(),
});
export type BasicMovie = v.InferOutput<typeof BasicMovieSchema>;

export const MovieSchema = v.looseObject({
	...BasicMovieSchema.entries,
	external_ids: v.fallback(MovieExternalIdsSchema, {
		imdb_id: null,
		wikidata_id: null,
		facebook_id: null,
		instagram_id: null,
		twitter_id: null,
	}),
	images: v.fallback(MediaImagesSchema, {
		id: null,
		backdrops: [],
		logos: [],
		posters: [],
	}),
	credits: v.fallback(CreditsSchema, { cast: [], crew: [] }),
	videos: v.fallback(MediaVideosSchema, { id: null, results: [] }),
	release_dates: v.fallback(MovieReleaseDatesSchema, { results: [] }),
	keywords: v.fallback(MovieKeywordsSchema, { keywords: [] }),
});
export type Movie = v.InferOutput<typeof MovieSchema>;

export const MovieRecommendationsResultsEntitySchema = v.looseObject({
	adult: bool(),
	backdrop_path: strNull(),
	genre_ids: v.nullish(v.array(v.number()), () => []),
	id: v.number(),
	original_language: str(),
	original_title: str(),
	overview: str(),
	popularity: num(),
	poster_path: strNull(),
	release_date: str(),
	title: str(),
	video: bool(),
	vote_average: num(),
	vote_count: num(),
});
export type MovieRecommendationsResultsEntity = v.InferOutput<
	typeof MovieRecommendationsResultsEntitySchema
>;

export const MovieRecommendationsSchema = paginated(
	MovieRecommendationsResultsEntitySchema,
);
export type MovieRecommendations = v.InferOutput<
	typeof MovieRecommendationsSchema
>;

export const CreatorSchema = v.looseObject({
	id: v.number(),
	credit_id: str(),
	name: str(),
	original_name: str(),
	gender: num(),
	profile_path: strNull(),
});
export type Creator = v.InferOutput<typeof CreatorSchema>;

export const EpisodeInfoSchema = v.looseObject({
	id: v.number(),
	name: str(),
	overview: str(),
	vote_average: num(),
	vote_count: num(),
	air_date: strNull(),
	episode_number: num(),
	episode_type: str(),
	production_code: str(),
	runtime: numOpt(),
	season_number: num(),
	show_id: num(),
	still_path: strNull(),
});
export type EpisodeInfo = v.InferOutput<typeof EpisodeInfoSchema>;

export const NetworkSchema = v.looseObject({
	id: v.number(),
	logo_path: strNull(),
	name: str(),
	origin_country: str(),
});
export type Network = v.InferOutput<typeof NetworkSchema>;

export const SeasonInfoSchema = v.looseObject({
	air_date: strNull(),
	episode_count: num(),
	id: v.number(),
	name: str(),
	overview: str(),
	poster_path: strNull(),
	season_number: num(),
	vote_average: num(),
});
export type SeasonInfo = v.InferOutput<typeof SeasonInfoSchema>;

export const BasicTvSchema = v.looseObject({
	adult: bool(),
	backdrop_path: strNull(),
	created_by: v.nullish(v.array(CreatorSchema), () => []),
	episode_run_time: v.nullish(v.array(v.unknown()), () => []),
	first_air_date: str(),
	genres: v.nullish(v.array(GenreSchema), () => []),
	homepage: strNull(),
	id: v.number(),
	in_production: bool(),
	languages: v.nullish(v.array(v.string()), () => []),
	last_air_date: str(),
	last_episode_to_air: v.nullable(EpisodeInfoSchema),
	name: str(),
	next_episode_to_air: v.nullable(v.unknown()),
	networks: v.nullish(v.array(NetworkSchema), () => []),
	number_of_episodes: num(),
	number_of_seasons: num(),
	origin_country: v.nullish(v.array(v.string()), () => []),
	original_language: str(),
	original_name: str(),
	overview: str(),
	popularity: num(),
	poster_path: strNull(),
	production_companies: v.nullish(v.array(ProductionCompanySchema), () => []),
	production_countries: v.nullish(v.array(ProductionCountrySchema), () => []),
	seasons: v.nullish(v.array(SeasonInfoSchema), () => []),
	spoken_languages: v.nullish(v.array(SpokenLanguageSchema), () => []),
	status: str(),
	tagline: strNull(),
	type: str(),
	vote_average: num(),
	vote_count: num(),
});
export type BasicTv = v.InferOutput<typeof BasicTvSchema>;

export const TvExternalIdsSchema = v.looseObject({
	imdb_id: strNull(),
	freebase_mid: strNull(),
	freebase_id: strNull(),
	tvdb_id: numNull(),
	tvrage_id: numNull(),
	wikidata_id: strNull(),
	facebook_id: strNull(),
	instagram_id: strNull(),
	twitter_id: strNull(),
});
export type TvExternalIds = v.InferOutput<typeof TvExternalIdsSchema>;

export const RecommendationResultSchema = v.looseObject({
	backdrop_path: strNull(),
	id: v.number(),
	name: str(),
	original_name: str(),
	overview: str(),
	poster_path: strNull(),
	media_type: str("tv"),
	adult: bool(),
	original_language: str(),
	genre_ids: v.nullish(v.array(v.number()), () => []),
	popularity: num(),
	first_air_date: str(),
	vote_average: num(),
	vote_count: num(),
	origin_country: v.nullish(v.array(v.string()), () => []),
});
export type RecommendationResult = v.InferOutput<
	typeof RecommendationResultSchema
>;

export const TvRecommendationsSchema = paginated(RecommendationResultSchema);
export type TvRecommendations = v.InferOutput<typeof TvRecommendationsSchema>;

export const TvKeywordsSchema = v.looseObject({
	results: v.nullish(v.array(KeywordResultSchema), () => []),
});
export type TvKeywords = v.InferOutput<typeof TvKeywordsSchema>;

export const ContentRatingsResultsEntitySchema = v.looseObject({
	descriptors: v.nullish(v.array(v.unknown()), () => []),
	iso_3166_1: str(),
	rating: str(),
});
export type ContentRatingsResultsEntity = v.InferOutput<
	typeof ContentRatingsResultsEntitySchema
>;

export const ContentRatingsSchema = v.looseObject({
	results: v.nullish(v.array(ContentRatingsResultsEntitySchema), () => []),
});
export type ContentRatings = v.InferOutput<typeof ContentRatingsSchema>;

export const TvSchema = v.looseObject({
	...BasicTvSchema.entries,
	external_ids: v.fallback(TvExternalIdsSchema, {
		imdb_id: null,
		freebase_mid: null,
		freebase_id: null,
		tvdb_id: null,
		tvrage_id: null,
		wikidata_id: null,
		facebook_id: null,
		instagram_id: null,
		twitter_id: null,
	}),
	images: v.fallback(MediaImagesSchema, {
		id: null,
		backdrops: [],
		logos: [],
		posters: [],
	}),
	credits: v.fallback(CreditsSchema, { cast: [], crew: [] }),
	videos: v.fallback(MediaVideosSchema, { id: null, results: [] }),
	recommendations: v.fallback(TvRecommendationsSchema, {
		page: 1,
		results: [],
		total_pages: 1,
		total_results: 0,
	}),
	keywords: v.fallback(TvKeywordsSchema, { results: [] }),
	content_ratings: v.fallback(ContentRatingsSchema, { results: [] }),
});
export type Tv = v.InferOutput<typeof TvSchema>;

export const MediaRecommendationsResultsEntitySchema = v.looseObject({
	backdrop_path: strNull(),
	id: v.number(),
	title: strOpt(),
	name: strOpt(),
	original_title: strOpt(),
	original_name: strOpt(),
	overview: str(),
	poster_path: strNull(),
	media_type: str(),
	adult: bool(),
	original_language: str(),
	genre_ids: v.nullish(v.array(v.number()), () => []),
	popularity: num(),
	release_date: strOpt(),
	first_air_date: strOpt(),
	video: bool(),
	vote_average: num(),
	vote_count: num(),
});
export type MediaRecommendationsResultsEntity = v.InferOutput<
	typeof MediaRecommendationsResultsEntitySchema
>;

export const MediaRecommendationsSchema = paginated(
	MediaRecommendationsResultsEntitySchema,
);
export type MediaRecommendations = v.InferOutput<
	typeof MediaRecommendationsSchema
>;

export const TvEpisodeDetailSchema = v.pipe(
	v.looseObject({
		air_date: strNull(),
		episode_number: num(),
		episode_type: str(),
		id: v.number(),
		name: str(),
		overview: str(),
		production_code: str(),
		runtime: numNull(),
		season_number: num(),
		show_id: num(),
		still_path: strNull(),
		vote_average: num(),
		vote_count: num(),
	}),
	// TMDB inlines crew + guest_stars on EVERY episode of a season response;
	// nothing in the app renders them, and for a 20+ episode season they can
	// double the payload. Drop them at parse time so the cached object graph
	// (and the dehydrated SSR payload) stays small.
	v.transform((episode) => {
		delete episode.crew;
		delete episode.guest_stars;
		return episode;
	}),
);
export type TvEpisodeDetail = v.InferOutput<typeof TvEpisodeDetailSchema>;

export const TvSeasonDetailSchema = v.looseObject({
	_id: str(),
	air_date: strNull(),
	episodes: v.nullish(v.array(TvEpisodeDetailSchema), () => []),
	name: str(),
	overview: str(),
	id: v.number(),
	poster_path: strNull(),
	season_number: num(),
	vote_average: num(),
});
export type TvSeasonDetail = v.InferOutput<typeof TvSeasonDetailSchema>;

const personCreditBase = {
	adult: bool(),
	backdrop_path: strNull(),
	id: v.number(),
	original_language: str(),
	original_title: strOpt(),
	original_name: strOpt(),
	overview: str(),
	popularity: num(),
	poster_path: strNull(),
	release_date: strOpt(),
	first_air_date: strOpt(),
	title: strOpt(),
	name: strOpt(),
	video: bool(),
	vote_average: num(),
	vote_count: num(),
} satisfies v.ObjectEntries;

export const PersonCreditCastSchema = v.looseObject({
	...personCreditBase,
	genre_ids: v.nullish(v.array(v.number()), () => []),
	character: str(),
	credit_id: str(),
	order: num(),
	media_type: str("movie"),
	episode_count: numOpt(),
});
export type PersonCreditCast = v.InferOutput<typeof PersonCreditCastSchema>;

export const PersonCreditCrewSchema = v.looseObject({
	...personCreditBase,
	genre_ids: v.fallback(v.nullable(v.array(v.number())), []),
	department: str(),
	job: str(),
	credit_id: str(),
	media_type: str("movie"),
	episode_count: numOpt(),
});
export type PersonCreditCrew = v.InferOutput<typeof PersonCreditCrewSchema>;

export const PersonResultCreditsSchema = v.looseObject({
	cast: v.fallback(v.nullable(v.array(PersonCreditCastSchema)), []),
	crew: v.fallback(v.nullable(v.array(PersonCreditCrewSchema)), []),
});
export type PersonResultCredits = v.InferOutput<
	typeof PersonResultCreditsSchema
>;

export const PersonDetailsSchema = v.looseObject({
	adult: bool(),
	also_known_as: v.fallback(v.nullable(v.array(v.string())), []),
	biography: str(),
	birthday: strNull(),
	deathday: strNull(),
	gender: num(),
	homepage: strNull(),
	id: v.number(),
	imdb_id: strNull(),
	known_for_department: str(),
	name: str(),
	place_of_birth: strNull(),
	popularity: num(),
	profile_path: strNull(),
	movie_credits: v.fallback(PersonResultCreditsSchema, { cast: [], crew: [] }),
	tv_credits: v.fallback(PersonResultCreditsSchema, { cast: [], crew: [] }),
	combined_credits: v.fallback(PersonResultCreditsSchema, {
		cast: [],
		crew: [],
	}),
	images: v.fallback(
		v.looseObject({
			profiles: v.fallback(v.nullable(v.array(ImageAssetSchema)), []),
		}),
		{ profiles: [] },
	),
	external_ids: v.fallback(
		v.looseObject({
			imdb_id: strNull(),
			facebook_id: strNull(),
			instagram_id: strNull(),
			twitter_id: strNull(),
			tiktok_id: strNull(),
			youtube_id: strNull(),
		}),
		{
			imdb_id: null,
			facebook_id: null,
			instagram_id: null,
			twitter_id: null,
			tiktok_id: null,
			youtube_id: null,
		},
	),
});
export type PersonDetails = v.InferOutput<typeof PersonDetailsSchema>;
