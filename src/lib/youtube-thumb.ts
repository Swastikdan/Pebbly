// YouTube video-id thumbnails support a quality ladder at
//   https://img.youtube.com/vi/<id>/<file>.jpg
// with progressively higher resolutions (and not every upload publishes every
// tier — notably `maxresdefault.jpg` 404s on many videos).
//
// We use a low-quality frame (`mqdefault`, 320x180) for the initial render and
// upgrade to a high-quality frame (`maxresdefault`, up to 1280x720) once the
// low frame is on screen. If the high tier does not exist (404), the consumer
// stays on the low frame that is already visible — no broken image, no flash.

export type YoutubeThumbTier = "default" | "mq" | "hq" | "maxres";

const THUMBNAIL_FILES: Record<YoutubeThumbTier, string> = {
  default: "default.jpg",
  mq: "mqdefault.jpg",
  hq: "hqdefault.jpg",
  maxres: "maxresdefault.jpg",
};

/** Resolution tiers (px) matching each file, only used for documentation. */
export const YOUTUBE_THUMBNAIL_TIERS: Record<YoutubeThumbTier, number> = {
  default: 120,
  mq: 320,
  hq: 480,
  maxres: 1280,
};

/** The low-quality tier used for the first, fast render. */
export const YOUTUBE_THUMBNAIL_LQ: YoutubeThumbTier = "mq";

/** The high-quality tier we progressively upgrade to. */
export const YOUTUBE_THUMBNAIL_HQ: YoutubeThumbTier = "maxres";

export function youtubeThumbUrl(
  videoKey: string,
  tier: YoutubeThumbTier = "default",
): string {
  return `https://img.youtube.com/vi/${videoKey}/${THUMBNAIL_FILES[tier]}`;
}
