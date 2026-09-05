import { GENRE_LIST, IMAGE_PREFIX } from "@/constants";

const FEATURED_ITEMS_LIMIT = 10;
const GENRE_LOOKUP = new Map(GENRE_LIST.map((genre) => [genre.id, genre]));

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

export const mapGenres = (genres?: MinimalGenre[] | null) => {
  if (!genres) {
    return [];
  }

  return genres
    .map((genre) => GENRE_LOOKUP.get(genre.id))
    .filter((genre): genre is NonNullable<typeof genre> => Boolean(genre));
};

export const splitVideos = (videos?: MinimalVideo[] | null) => {
  const allVideos = videos ?? [];

  const trailervideos = allVideos
    .filter((video) => video.type === "Trailer" || video.type === "Teaser")
    .sort((a, b) => (a.type === b.type ? 0 : a.type === "Trailer" ? -1 : 1));

  const youtubeclips = allVideos
    .filter((video) => video.type !== "Trailer" && video.type !== "Teaser")
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "Featurette" ? -1 : 1;
      }

      return (
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    })
    .slice(0, FEATURED_ITEMS_LIMIT);

  return { allVideos, trailervideos, youtubeclips };
};

// Cast/crew and backdrop/poster lists share the same shape-up pipeline
// (bound the list while preserving the API order); only the final per-item
// projection differs, so the shared part lives here once.
const featuredPeople = (people?: MinimalPerson[] | null) =>
  people?.slice(0, FEATURED_ITEMS_LIMIT) ?? [];

const featuredImages = (images?: MinimalImage[] | null) =>
  images?.slice(0, FEATURED_ITEMS_LIMIT) ?? [];

export const mapCast = (cast?: MinimalPerson[] | null) =>
  featuredPeople(cast).map((person) => ({
    id: person.id,
    name: person.name,
    profile_path: person.profile_path ?? undefined,
    character: person.character ?? "",
  }));

export const mapCrew = (crew?: MinimalPerson[] | null) =>
  featuredPeople(crew).map((person) => ({
    id: person.id,
    name: person.name,
    profile_path: person.profile_path ?? undefined,
    job: person.job ?? "",
  }));

export const mapBackdrops = (backdrops?: MinimalImage[] | null) =>
  featuredImages(backdrops).map((image) => ({
    backdrop_image: `${IMAGE_PREFIX.SD_BACKDROP}${image.file_path}`,
    backdrop_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
    aspect_ratio: image.aspect_ratio,
  }));

export const mapPosters = (posters?: MinimalImage[] | null) =>
  featuredImages(posters).map((image) => ({
    poster_image: `${IMAGE_PREFIX.SD_POSTER}${image.file_path}`,
    poster_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
    aspect_ratio: image.aspect_ratio,
  }));

// Both certification lookups find the US entry and extract a rating,
// defaulting to "NR" when the entry or the value is missing.
function findUSCertification<T extends { iso_3166_1: string }>(
  items: T[] | null | undefined,
  extract: (item: T) => string | undefined,
): string {
  const us = items?.find((item) => item.iso_3166_1 === "US");
  return (us ? extract(us) : undefined) ?? "NR";
}

export const getMovieCertification = (
  releaseDates?:
    | {
        iso_3166_1: string;
        release_dates?: { certification?: string }[] | null;
      }[]
    | null,
) =>
  findUSCertification(releaseDates, (us) => {
    for (const releaseDate of us.release_dates ?? []) {
      if (releaseDate?.certification) {
        return releaseDate.certification;
      }
    }
    return undefined;
  });

export const getTvCertification = (
  contentRatings?: { iso_3166_1: string; rating?: string }[] | null,
) => findUSCertification(contentRatings, (us) => us.rating);

const THEATRICAL_RELEASE_TYPES = new Set([2, 3]);
const THEATRICAL_WINDOW_DAYS = 60;

export const isInTheatricalWindow = (
  releaseDate?: string | null,
  releaseDates?:
    | {
        release_dates?:
          { type?: number | null; release_date?: string }[] | null;
      }[]
    | null,
) => {
  if (!releaseDate) {
    return false;
  }
  const daysSince = (Date.now() - new Date(releaseDate).getTime()) / 86_400_000;
  if (!Number.isFinite(daysSince)) {
    return false;
  }
  const isRecent = daysSince >= 0 && daysSince <= THEATRICAL_WINDOW_DAYS;
  const hadTheatricalRelease =
    releaseDates?.some((region) =>
      region.release_dates?.some((entry) =>
        THEATRICAL_RELEASE_TYPES.has(entry.type ?? 0),
      ),
    ) ?? false;
  const hasDigitalReleasePassed =
    releaseDates?.some((region) =>
      region.release_dates?.some((entry) => {
        if (entry.type !== 4 || !entry.release_date) return false;
        const digitalTime = new Date(entry.release_date).getTime();
        return Number.isFinite(digitalTime) && digitalTime <= Date.now();
      }),
    ) ?? false;

  return isRecent && hadTheatricalRelease && !hasDigitalReleasePassed;
};

export const formatRuntime = (runtime?: number) =>
  runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : null;

export const getPosterImage = (
  posterPath: string | null | undefined,
  fallback = "https://placehold.co/300x450?text=Image+Not+Found",
) => (posterPath ? `${IMAGE_PREFIX.HD_POSTER}${posterPath}` : fallback);
