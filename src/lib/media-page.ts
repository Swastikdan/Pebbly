import {
	getPosterImage,
	mapBackdrops,
	mapCast,
	mapCrew,
	mapGenres,
	mapPosters,
	splitVideos,
} from "@/lib/media-transform";
import { formatMediaTitle } from "@/lib/utils";

type SharedMediaPageInput = {
	title?: string | null;
	originalTitle?: string | null;
	posterPath?: string | null;
	releaseDate?: string | null;
	genres?: Parameters<typeof mapGenres>[0];
	images?: {
		backdrops?: Parameters<typeof mapBackdrops>[0];
		posters?: Parameters<typeof mapPosters>[0];
	};
	credits?: {
		cast?: Parameters<typeof mapCast>[0];
		crew?: Parameters<typeof mapCrew>[0];
	};
	videos?: {
		results?: Parameters<typeof splitVideos>[0];
	};
};

export function buildSharedMediaPageData(input: SharedMediaPageInput) {
	const displayTitle = input.title ?? input.originalTitle ?? "Unknown Title";

	return {
		urltitle: formatMediaTitle.encode(displayTitle),
		displayTitle,
		image: getPosterImage(input.posterPath ?? undefined),
		releaseYear: input.releaseDate
			? new Date(input.releaseDate).getFullYear()
			: null,
		genres: mapGenres(input.genres),
		cast: mapCast(input.credits?.cast),
		crew: mapCrew(input.credits?.crew),
		backdrops: mapBackdrops(input.images?.backdrops),
		posters: mapPosters(input.images?.posters),
		...splitVideos(input.videos?.results),
	};
}