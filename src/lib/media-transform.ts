import { GENRE_LIST, IMAGE_PREFIX } from "@/constants";

const FEATURED_ITEMS_LIMIT = 10;

interface MinimalGenre {
	id: number;
}

interface MinimalVideo {
	key: string;
	name: string;
	type: string;
	published_at: string;
	official: boolean;
}

interface MinimalPerson {
	id: number;
	name: string;
	profile_path?: string | null;
	character?: string;
	job?: string;
}

interface MinimalImage {
	file_path: string;
	aspect_ratio: number;
	vote_average?: number;
}

// Keep all media data shaping in one place so route files stay focused on UI structure.
export const mapGenres = (genres?: MinimalGenre[] | null) => {
	if (!genres) {
		return [];
	}

	return genres
		.map((genre) => GENRE_LIST.find((genreItem) => genreItem.id === genre.id))
		.filter((genre): genre is NonNullable<typeof genre> => Boolean(genre));
};

const normalizeVideos = (videos?: MinimalVideo[] | null) =>
	videos?.map((video) => ({
		key: video.key,
		name: video.name,
		type: video.type,
		published_at: video.published_at,
		official: video.official,
	})) ?? [];

export const splitVideos = (videos?: MinimalVideo[] | null) => {
	const normalizedVideos = normalizeVideos(videos);

	const trailervideos = normalizedVideos
		.filter((video) => video.type === "Trailer" || video.type === "Teaser")
		.sort((a, b) => (a.type === b.type ? 0 : a.type === "Trailer" ? -1 : 1));

	const youtubeclips = normalizedVideos
		.filter((video) => video.type !== "Trailer" && video.type !== "Teaser")
		.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === "Featurette" ? -1 : 1;
			}

			return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
		})
		.slice(0, FEATURED_ITEMS_LIMIT);

	return { normalizedVideos, trailervideos, youtubeclips };
};

export const mapCast = (cast?: MinimalPerson[] | null) =>
	cast
		?.map((person) => ({
			id: person.id,
			name: person.name,
			profile_path: person.profile_path ?? undefined,
			character: person.character ?? "",
		}))
		.slice(0, FEATURED_ITEMS_LIMIT) ?? [];

export const mapCrew = (crew?: MinimalPerson[] | null) =>
	crew
		?.map((person) => ({
			id: person.id,
			name: person.name,
			profile_path: person.profile_path ?? undefined,
			job: person.job ?? "",
		}))
		.slice(0, FEATURED_ITEMS_LIMIT) ?? [];

const sortByVoteAverage = (a: MinimalImage, b: MinimalImage) =>
	(b.vote_average ?? 0) - (a.vote_average ?? 0);

export const mapBackdrops = (backdrops?: MinimalImage[] | null) =>
	backdrops
		?.slice()
		.sort(sortByVoteAverage)
		.map((image) => ({
			backdrop_image: `${IMAGE_PREFIX.SD_BACKDROP}${image.file_path}`,
			backdrop_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
			aspect_ratio: image.aspect_ratio,
		}))
		.slice(0, FEATURED_ITEMS_LIMIT) ?? [];

export const mapPosters = (posters?: MinimalImage[] | null) =>
	posters
		?.slice()
		.sort(sortByVoteAverage)
		.map((image) => ({
			poster_image: `${IMAGE_PREFIX.SD_POSTER}${image.file_path}`,
			poster_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
			aspect_ratio: image.aspect_ratio,
		}))
		.slice(0, FEATURED_ITEMS_LIMIT) ?? [];

export const getMovieCertification = (
	releaseDates?:
		| {
				iso_3166_1: string;
				release_dates?: { certification?: string }[] | null;
		  }[]
		| null,
) => {
	const usRelease = releaseDates?.find((release) => release.iso_3166_1 === "US");

	if (!usRelease?.release_dates) {
		return "NR";
	}

	for (const releaseDate of usRelease.release_dates) {
		if (releaseDate?.certification) {
			return releaseDate.certification;
		}
	}

	return "NR";
};

export const getTvCertification = (
	contentRatings?: { iso_3166_1: string; rating?: string }[] | null,
) =>
	contentRatings?.find((result) => result.iso_3166_1 === "US")?.rating ?? "NR";

export const formatRuntime = (runtime?: number) =>
	runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : null;

export const getPosterImage = (
	posterPath: string | null | undefined,
	fallback = "https://placehold.co/300x450?text=Image+Not+Found",
) => (posterPath ? `${IMAGE_PREFIX.HD_POSTER}${posterPath}` : fallback);
