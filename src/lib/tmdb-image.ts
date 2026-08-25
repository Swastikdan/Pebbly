// TMDB image URLs are fixed-size variants of one CDN asset:
//   https://image.tmdb.org/t/p/<size>/<path>
// The CDN accepts any documented width prefix for any image, so a single
// source URL can be expanded into a srcset ladder and the browser picks the
// cheapest variant that satisfies `sizes`. @unpic has no TMDB provider, which
// is why every poster grid previously downloaded the same w500/w780 JPEG on
// phones and desktops alike.

const TMDB_IMAGE_URL_RE = /^(https:\/\/image\.tmdb\.org\/t\/p\/)([^/]+)(\/.+)$/;

/**
 * Widths TMDB documents across poster/backdrop/still/logo categories,
 * deduped and ascending. Every entry is a valid `/t/p/<size>` prefix for any
 * image, so one universal ladder covers posters, backdrops, profiles, and
 * episode stills without needing to know the image class.
 */
const WIDTH_LADDER = [92, 154, 185, 300, 342, 500, 780, 1280] as const;

const H632_APPROX_WIDTH = 421;

/**
 * Expands a TMDB image URL into a `srcset` value whose candidates span
 * TMDB's documented size tiers. Returns undefined for non-TMDB URLs (data:
 * placeholders, ImageKit, YouTube thumbs) so callers can pass the result
 * straight through.
 *
 * h632 (height-constrained profile variant) maps to its approximate rendered
 * width so width descriptors stay honest for 2:3 portrait crops.
 */
export function tmdbSrcSet(src: string): string | undefined {
  const match = TMDB_IMAGE_URL_RE.exec(src);
  if (!match) return undefined;

  const [, base, currentSize, path] = match;
  const entries = new Set<string>();

  if (/^h\d+/.test(currentSize)) {
    // Height-constrained sizes have variable widths; include the original
    // variant plus its approximate pixel width rather than guessing ladders.
    entries.add(`${base}${currentSize}${path} ${H632_APPROX_WIDTH}w`);
    entries.add(`${base}w185${path} 185w`);
  } else {
    for (const width of WIDTH_LADDER) {
      entries.add(`${base}w${width}${path} ${width}w`);
    }
    // Exotic/undocumented prefixes ("original", custom crops) are dropped on
    // purpose: their real width is unknowable, and capping the ladder at
    // w1280 keeps a stray hero image from pulling a multi-megabyte file.
    void currentSize;
  }

  return [...entries].join(", ");
}
