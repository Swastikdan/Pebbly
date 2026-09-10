import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  YOUTUBE_THUMBNAIL_HQ,
  YOUTUBE_THUMBNAIL_LQ,
  youtubeThumbUrl,
} from "@/lib/youtube-thumb";

/**
 * Progressive YouTube thumbnail.
 *
 * Renders the low-quality frame (`mqdefault`) first — fast even on slow
 * connections — and, only after that frame is on screen, mounts a second,
 * high-quality frame (`maxresdefault`) on top that crossfades in once it
 * decodes. Uploads that never published a `maxres` frame 404, leaving the
 * already-visible low-quality frame in place: no broken image, no skeleton
 * flash, no layout jump.
 *
 * The low frame always stays beneath the high frame, so the upgrade reads as a
 * smooth "gradually sharper" transition instead of a swap-to-placeholder.
 */
export function YouTubeThumbnail({
  videoKey,
  alt,
  className,
  width,
  height,
}: {
  videoKey: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const lqSrc = youtubeThumbUrl(videoKey, YOUTUBE_THUMBNAIL_LQ);
  const hqSrc = youtubeThumbUrl(videoKey, YOUTUBE_THUMBNAIL_HQ);

  // Used to tell a brand-new key from a re-render of the same one, so the
  // skeleton + LQ frame reliably reset when the rail cycles to another video.
  const [key, setKey] = useState(videoKey);
  const [lqReady, setLqReady] = useState(false);
  const [hqReady, setHqReady] = useState(false);

  if (key !== videoKey) {
    setKey(videoKey);
    setLqReady(false);
    setHqReady(false);
  }

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={
        width && height ? { aspectRatio: `${width} / ${height}` } : undefined
      }
    >
      {/* Low-quality frame: defines the box and shows first. */}
      <img
        src={lqSrc}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
        onLoad={() => setLqReady(true)}
        // If even the low frame is unavailable, drop the skeleton so the tile
        // doesn't shimmer forever — the rail overlay still labels it.
        onError={() => setLqReady(true)}
      />

      {!lqReady && <Skeleton className="absolute inset-0 rounded-none" />}

      {/* High-quality frame: only fetched once the low frame is showing, then
          crossfaded over it. A missing maxres frame (onError) simply leaves it
          at opacity-0 — the low frame already fills the tile. */}
      {lqReady && (
        <img
          src={hqSrc}
          alt=""
          aria-hidden="true"
          width={width}
          height={height}
          loading="lazy"
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
            !hqReady && "opacity-0",
          )}
          onLoad={() => setHqReady(true)}
          onError={() => undefined}
        />
      )}
    </div>
  );
}
