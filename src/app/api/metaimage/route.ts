import { type NextRequest, NextResponse } from "next/server";
import { getBasicMovieDetails, getBasicTvDetails } from "@/lib/queries";
import { isValidId } from "@/lib/utils";
import { IMAGE_PREFIX, DEFAULT_PLACEHOLDER_IMAGE } from "@/constants";
import type { BasicMovie, BasicTv } from "@/types";

// Cache configuration for optimal performance
const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  "CDN-Cache-Control": "public, max-age=31536000",
} as const;

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

  try {
    // Fetch images with extended cache
    const data =
      type === "movie"
        ? await getBasicMovieDetails({ id: Number(id) })
        : await getBasicTvDetails({ id: Number(id) });

    // Select best available image
    const imageUrl = getImageUrl(data);

    // Fetch and stream the image
    const imageResponse = await fetch(imageUrl, {
      next: { revalidate: 86400 },
      headers: {
        Accept: "image/webp,image/jpeg,image/png,*/*",
        "User-Agent": "MovieApp/1.0",
      },
    });

    if (!imageResponse.ok) {
      throw new Error(`Image fetch failed: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("content-type") ?? "image/jpeg";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": imageBuffer.byteLength.toString(),
        ...CACHE_HEADERS,
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Image fetch error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch image",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: ERROR_HEADERS },
    );
  }
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

// Optimized HEAD method for preflight requests
export async function HEAD(request: NextRequest) {
  const response = await GET(request);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}

// CORS support
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: "GET, HEAD, OPTIONS",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
