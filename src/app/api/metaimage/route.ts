import { type NextRequest, NextResponse } from "next/server";
import { getBasicMovieDetails, getBasicTvDetails } from "@/lib/queries";
import { isValidId } from "@/lib/utils";
import { IMAGE_PREFIX } from "@/constants";
import type { BasicMovie, BasicTv } from "@/types";

const ERROR_HEADERS = { "Cache-Control": "no-cache" } as const;
const DEFAULT_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
} as const;
const PLACEHOLDER_URL =
  "https://placehold.jp/20/f2f2f2/000000/200x300.jpg?text=No+Image";

function getPlaceholderWithText(text: string): string {
  return `https://placehold.jp/20/f2f2f2/000000/200x300.jpg?text=${encodeURIComponent(text)}`;
}

async function getImageRedirect(
  data: BasicMovie | BasicTv | null,
  isMovie: boolean,
): Promise<NextResponse> {
  if (!data) {
    return NextResponse.redirect(PLACEHOLDER_URL, { headers: ERROR_HEADERS });
  }

  if (data.poster_path) {
    return NextResponse.redirect(IMAGE_PREFIX.SD_POSTER + data.poster_path, {
      headers: DEFAULT_HEADERS,
    });
  }

  if (data.backdrop_path) {
    return NextResponse.redirect(
      IMAGE_PREFIX.SD_BACKDROP + data.backdrop_path,
      { headers: DEFAULT_HEADERS },
    );
  }

  const title = isMovie ? (data as BasicMovie).title : (data as BasicTv).name;
  return NextResponse.redirect(getPlaceholderWithText(title || "No Image"), {
    headers: DEFAULT_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  if (
    !type ||
    !id ||
    !isValidId(Number(id)) ||
    !["movie", "tv"].includes(type)
  ) {
    return NextResponse.redirect(PLACEHOLDER_URL, { headers: ERROR_HEADERS });
  }

  try {
    if (type === "movie") {
      const movieData = await getBasicMovieDetails({ id: Number(id) });
      return await getImageRedirect(movieData, true);
    } else if (type === "tv") {
      const tvData = await getBasicTvDetails({ id: Number(id) });
      return await getImageRedirect(tvData, false);
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.redirect(PLACEHOLDER_URL, { headers: ERROR_HEADERS });
  }

  // Fallback (should not be reached due to validation)
  return NextResponse.redirect(PLACEHOLDER_URL, { headers: ERROR_HEADERS });
}
