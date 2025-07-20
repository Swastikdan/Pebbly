import { type NextRequest, NextResponse } from "next/server";
import { getBasicMovieDetails, getBasicTvDetails } from "@/lib/queries";
import { isValidId } from "@/lib/utils";
import { IMAGE_PREFIX, DEFAULT_PLACEHOLDER_IMAGE } from "@/constants";
import type { BasicMovie, BasicTv } from "@/types";

const ERROR_HEADERS = { "Cache-Control": "no-cache" } as const;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  // Validate parameters
  if (
    !type ||
    !id ||
    !isValidId(Number(id)) ||
    !["movie", "tv"].includes(type)
  ) {
    return NextResponse.json(
      { error: "Invalid parameters. Required: type (movie|tv) and valid id" },
      { status: 400, headers: ERROR_HEADERS },
    );
  }
  const data =
    type === "movie"
      ? await getBasicMovieDetails({ id: Number(id) })
      : await getBasicTvDetails({ id: Number(id) });

  // Select best available image URL
  const imageUrl = getImageUrl(data);
  return NextResponse.redirect(imageUrl);
}

// Helper function to determine best image URL
function getImageUrl(data: BasicMovie | BasicTv): string {
  if (data.poster_path) {
    return IMAGE_PREFIX.SD_POSTER + data.poster_path;
  }
  if (data.backdrop_path) {
    return IMAGE_PREFIX.SD_BACKDROP + data.backdrop_path;
  }

  return DEFAULT_PLACEHOLDER_IMAGE;
}
