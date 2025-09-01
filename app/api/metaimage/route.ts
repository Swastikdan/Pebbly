import type { BasicMovie, BasicTv } from "@/types";

import { type NextRequest, NextResponse } from "next/server";

import { isValidId } from "@/lib/utils";
import { getBasicMovieDetails, getBasicTvDetails } from "@/lib/quries";
import { IMAGE_PREFIX } from "@/config/image";

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
): Promise<NextResponse> {
  if (!data) {
    return NextResponse.redirect(getPlaceholderWithText(), {
      headers: ERROR_HEADERS,
    });
  }

  // Prefer poster, then backdrop
  const poster = (data as BasicMovie | BasicTv).poster_path;
  const backdrop = (data as BasicMovie | BasicTv).backdrop_path;

  let imageUrl: string | null = null;

  if (poster) {
    imageUrl = (IMAGE_PREFIX.SD_POSTER ?? "") + poster;
  } else if (backdrop) {
    imageUrl = (IMAGE_PREFIX.SD_BACKDROP ?? "") + backdrop;
  }

  if (imageUrl) {
    return NextResponse.redirect(imageUrl, {
      headers: DEFAULT_HEADERS,
    });
  }

  const title = isMovie ? (data as BasicMovie).title : (data as BasicTv).name;

  return NextResponse.redirect(
    getPlaceholderWithText(title || FALLBACK_TITLE),
    {
      headers: DEFAULT_HEADERS,
    },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const rawType = searchParams.get("type");
  const rawId = searchParams.get("id");

  // Validate query params early
  const type = rawType?.toLowerCase();
  const idNum = rawId ? Number(rawId) : NaN;

  if (
    !type ||
    !rawId ||
    !isValidId(idNum) ||
    (type !== "movie" && type !== "tv")
  ) {
    return NextResponse.redirect(getPlaceholderWithText(), {
      headers: ERROR_HEADERS,
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
  } catch (err) {
    // Log but don't leak internal errors to clients
    // eslint-disable-next-line no-console
    console.error("/api/metaimage failed:", err);

    return NextResponse.redirect(getPlaceholderWithText(), {
      headers: ERROR_HEADERS,
    });
  }
}
