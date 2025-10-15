import { createFileRoute } from "@tanstack/react-router";
import { IMAGE_PREFIX } from "@/constants";
import { getBasicMovieDetails, getBasicTvDetails } from "@/lib/queries";
import { isValidId } from "@/lib/utils";
import type { BasicMovie, BasicTv } from "@/types";

const ERROR_HEADERS = { "Cache-Control": "no-cache" } as const;
const DEFAULT_HEADERS = {
	"Cache-Control": "public, max-age=31536000, immutable",
} as const;

const FALLBACK_TITLE = "Film Fanatic";

function getPlaceholderWithText(text = FALLBACK_TITLE): string {
	const encoded = encodeURIComponent(text || FALLBACK_TITLE);
	return `https://placehold.jp/20/f2f2f2/000000/200x300.jpg?text=${encoded}`;
}

/**
 * Pick the best available image URL for the media item and return a redirect response.
 */
async function getImageRedirect(
	data: BasicMovie | BasicTv | null,
	isMovie: boolean,
): Promise<Response> {
	if (!data) {
		return new Response(null, {
			status: 302,
			headers: {
				...DEFAULT_HEADERS,
				Location: getPlaceholderWithText(),
			},
		});
	}

	const poster = (data as BasicMovie | BasicTv).poster_path;
	const backdrop = (data as BasicMovie | BasicTv).backdrop_path;

	let imageUrl: string | null = null;

	if (poster) {
		imageUrl = (IMAGE_PREFIX.SD_POSTER ?? "") + poster;
	} else if (backdrop) {
		imageUrl = (IMAGE_PREFIX.SD_BACKDROP ?? "") + backdrop;
	}

	if (imageUrl) {
		return new Response(null, {
			status: 302,
			headers: {
				...DEFAULT_HEADERS,
				Location: imageUrl,
			},
		});
	}

	const title = isMovie ? (data as BasicMovie).title : (data as BasicTv).name;

	return new Response(null, {
		status: 302,
		headers: {
			...DEFAULT_HEADERS,
			Location: getPlaceholderWithText(title || FALLBACK_TITLE),
		},
	});
}

export const Route = createFileRoute("/api/metaimage")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				// Parse search params from the request URL
				const url = new URL(request.url);
				const rawType = url.searchParams.get("type");
				const rawId = url.searchParams.get("id");

				// Validate query params early
				const type = rawType?.toLowerCase();
				const idNum = rawId ? parseInt(rawId, 10) : NaN;

				if (
					!type ||
					!rawId ||
					!isValidId(idNum) ||
					(type !== "movie" && type !== "tv")
				) {
					return new Response(null, {
						status: 302,
						headers: {
							...DEFAULT_HEADERS,
							Location: getPlaceholderWithText(),
						},
					});
				}

				try {
					if (type === "movie") {
						const movieData = await getBasicMovieDetails({ id: idNum });
						return await getImageRedirect(movieData, true);
					}

					// type === 'tv'
					const tvData = await getBasicTvDetails({ id: idNum });
					return await getImageRedirect(tvData, false);
				} catch {
					return new Response(null, {
						status: 302,
						headers: {
							...ERROR_HEADERS,
							Location: getPlaceholderWithText(),
						},
					});
				}
			},
		},
	},
});
