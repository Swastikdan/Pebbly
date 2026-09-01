import { lazy, Suspense } from "react";

import type { MediaType } from "@/domain/media";
import {
  PlayOverlay,
  YouTubeEmbed,
} from "@/components/media/media-lightbox-dialog";
import { MediaThumbRail } from "@/components/media/media-thumb-rail";
import { Image } from "@/components/ui/image";
import { useWatchProgress } from "@/hooks/watch-progress/use-watch-progress";

const VideoPlayerModal = lazy(() =>
  import("@/components/video-player-modal").then((m) => ({
    default: m.VideoPlayerModal,
  })),
);

export function MediaPosterTrailerContainer(props: {
  tmdbId: number;
  type: MediaType;
  image: string;
  title: string;
  trailervideos: Array<{ key: string; name: string }>;
}) {
  const { tmdbId, type, image, title, trailervideos } = props;
  const { progress } = useWatchProgress(tmdbId, type);

  let defaultSeason: number | undefined;
  let defaultEpisode: number | undefined;

  if (type === "tv") {
    if (progress?.context?.season && progress?.context?.episode) {
      defaultSeason = progress.context.season;
      defaultEpisode = progress.context.episode;
    } else {
      defaultSeason = 1;
      defaultEpisode = 1;
    }
  }

  return (
    <div
      className="animate-fade-in-up flex flex-col justify-start gap-3 pb-3 sm:flex-row"
      style={{ animationDelay: "100ms" }}
    >
      <div className="surface-raised group relative w-full shrink-0 overflow-hidden rounded-xl sm:w-auto">
        <Image
          alt={title}
          className="bg-secondary aspect-2/3 h-full w-full rounded-xl object-cover sm:h-56 sm:w-auto md:h-70 lg:h-80"
          height={450}
          src={image}
          width={300}
          priority
        />

        <Suspense fallback={null}>
          <VideoPlayerModal
            tmdbId={tmdbId}
            type={type}
            title={title}
            variant="card"
            className="bg-black opacity-100 transition-colors hover:bg-black"
            season={defaultSeason}
            episode={defaultEpisode}
          />
        </Suspense>
      </div>

      {trailervideos.length > 0 && (
        <MediaThumbRail
          items={trailervideos}
          paramKey="trailer"
          getKey={(video) => video.key}
          getThumbSrc={(video) =>
            `https://img.youtube.com/vi/${video.key}/sddefault.jpg`
          }
          getThumbAlt={(video) => video.name}
          imageClassName="bg-accent aspect-video h-48 w-auto rounded-xl object-cover sm:h-56 md:h-70 lg:h-80"
          renderTileOverlay={(video) => (
            <>
              <span className="bg-background text-foreground dark:bg-foreground dark:text-background absolute top-4 left-4 w-min max-w-50 truncate rounded-lg px-2 py-1 text-sm sm:max-w-62.5">
                {video.name}
              </span>
              <PlayOverlay />
            </>
          )}
          getLightboxTitle={(video) => video.name}
          prevLabel="Previous trailer"
          nextLabel="Next trailer"
          lightboxOverlayClassName="bg-black"
          lightboxContentClassName="aspect-video w-full max-w-[95vw] gap-0 overflow-hidden rounded-xl border-0 p-0 ring-0 sm:max-w-[85vw]"
          renderLightboxBody={(video) => (
            <div className="bg-foreground/10 relative isolate z-1 size-full h-full overflow-hidden rounded-xl p-0">
              <YouTubeEmbed videoKey={video.key} title={video.name} />
            </div>
          )}
          scrollContainerClassName="h-full flex-1"
          railClassName="flex h-full gap-3"
        />
      )}
    </div>
  );
}
