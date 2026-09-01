import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import type { MediaType } from "@/domain/media";
import type {
  MediaImages,
  MediaVideos,
  MediaVideosResultsEntity,
} from "@/lib/tmdb-schemas";
import {
  PlayOverlay,
  YouTubeEmbed,
} from "@/components/media/media-lightbox-dialog";
import { MediaThumbRail } from "@/components/media/media-thumb-rail";
import { ScrollContainer } from "@/components/scroll-container";
import { SkeletonGrid } from "@/components/ui/feedback";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";
import { getImageDialogKey } from "@/lib/media-dialog-helpers";
import { getImages, getVideos } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

const sortVideos = (videos: MediaVideosResultsEntity[] | undefined | null) => {
  if (!videos) return [];
  return [...videos].sort((a, b) => {
    const typeOrder: Record<string, number> = {
      Trailer: 0,
      Teaser: 1,
      Featurette: 2,
    };
    const aOrder = typeOrder[a.type] ?? 3;
    const bOrder = typeOrder[b.type] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  });
};

export const MediaVideoImageContainer = (props: {
  id: number;
  media_type: MediaType;
}) => {
  const { id, media_type } = props;

  const queryConfigs = useMemo(
    () => [
      {
        queryKey: queryKeys.tmdb.videos(id, media_type),
        queryFn: async () => getVideos({ id, type: media_type }),
      },
      {
        queryKey: queryKeys.tmdb.images(id, media_type),
        queryFn: async () => getImages({ id, type: media_type }),
      },
    ],
    [id, media_type],
  );

  const queries = useQueries({ queries: queryConfigs });

  const rawVideos = (queries[0].data as unknown as MediaVideos | undefined)
    ?.results;
  const mediaImages = queries[1].data as unknown as MediaImages;
  const mediaVideos = useMemo(() => sortVideos(rawVideos), [rawVideos]);

  const isGlobalLoading = queries.some((q) => q.isPending);

  if (isGlobalLoading) return <GLobalMediaVideoImageContainerLoader />;

  return (
    <>
      <div className="flex flex-col gap-5 py-3">
        <span className="font-heading w-fit text-xl font-semibold md:text-2xl">
          Videos
        </span>
        <MediaThumbRail
          items={mediaVideos}
          paramKey="video"
          getKey={(video) => video.key}
          getThumbSrc={(video) =>
            `https://img.youtube.com/vi/${video.key}/sddefault.jpg`
          }
          getThumbAlt={(video) => video.name}
          imageClassName="bg-accent aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
          renderTileOverlay={(video) => (
            <>
              <div className="absolute top-3 left-3 flex max-w-[80%] items-center gap-1.5">
                <span className="text-foreground bg-background/90 dark:bg-foreground/90 dark:text-background truncate rounded-lg px-2 py-0.5 text-sm">
                  {video.name}
                </span>
                <span className="shrink-0 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                  {video.type}
                </span>
              </div>
              <PlayOverlay />
            </>
          )}
          getLightboxTitle={(video) => video.name}
          prevLabel="Previous video"
          nextLabel="Next video"
          lightboxOverlayClassName="bg-white/40 dark:bg-black/70"
          lightboxContentClassName="aspect-video w-full max-w-[95vw] gap-0 overflow-hidden rounded-xl border-0 p-0 ring-0 sm:max-w-[85vw]"
          renderLightboxBody={(video) => (
            <div className="bg-foreground/10 size-full overflow-hidden rounded-xl">
              <YouTubeEmbed videoKey={video.key} title={video.name} />
            </div>
          )}
        />
      </div>
      <div className="flex flex-col gap-5 py-3 pb-32">
        <span className="font-heading w-fit text-xl font-semibold md:text-2xl">
          Images
        </span>
        <div className="flex flex-col gap-3">
          <span className="w-fit text-lg md:text-xl">Backdrops</span>
          <MediaThumbRail
            items={mediaImages?.backdrops ?? []}
            paramKey="backdrop"
            getKey={(image) => getImageDialogKey(image.file_path)}
            getThumbSrc={(image) => IMAGE_PREFIX.SD_BACKDROP + image.file_path}
            getThumbAlt={(image) => image.file_path}
            imageClassName="bg-foreground/10 aspect-video h-44 w-auto cursor-pointer rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
            getLightboxTitle={(image) => `${image.file_path} Backdrop Image`}
            prevLabel="Previous backdrop"
            nextLabel="Next backdrop"
            lightboxOverlayClassName="bg-white/10 dark:bg-black/70"
            lightboxContentClassName="bg-secondary aspect-video w-full max-w-[95vw] gap-0 overflow-hidden rounded-lg border-0 p-0 ring-0 sm:max-w-[90vw]"
            renderLightboxBody={(image) => (
              <div className="bg-secondary size-full overflow-hidden rounded-2xl">
                <Image
                  alt={image.file_path}
                  className="aspect-video size-full rounded-2xl object-cover"
                  height={300}
                  src={IMAGE_PREFIX.ORIGINAL + image.file_path}
                  width={450}
                />
              </div>
            )}
          />
          <span className="font-heading w-fit text-lg md:text-xl">Posters</span>
          <MediaThumbRail
            items={mediaImages?.posters ?? []}
            paramKey="poster"
            getKey={(image) => getImageDialogKey(image.file_path)}
            getThumbSrc={(image) => IMAGE_PREFIX.SD_POSTER + image.file_path}
            getThumbAlt={(image) => image.file_path}
            thumbWidth={450}
            thumbHeight={300}
            imageClassName="bg-foreground/10 aspect-[11/16] h-44 w-auto cursor-pointer rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
            getLightboxTitle={(image) => `${image.file_path} Poster Image`}
            prevLabel="Previous poster"
            nextLabel="Next poster"
            lightboxOverlayClassName="bg-white/40 dark:bg-black/70"
            lightboxContentClassName="bg-secondary aspect-[11/16] h-auto max-h-[90vh] w-full max-w-[90vw] gap-0 overflow-hidden rounded-lg border-0 p-0 ring-0 sm:h-full sm:w-auto"
            renderLightboxBody={(image) => (
              <div className="bg-secondary size-full overflow-hidden rounded-2xl">
                <Image
                  alt={image.file_path}
                  className="aspect-[11/16] h-auto w-full rounded-2xl object-center"
                  height={300}
                  src={IMAGE_PREFIX.ORIGINAL + image.file_path}
                  width={450}
                />
              </div>
            )}
          />
        </div>
      </div>
    </>
  );
};

const GLobalMediaVideoImageContainerLoader = () => {
  return (
    <>
      <div className="flex flex-col gap-5 py-3">
        <span className="font-heading w-fit text-xl font-semibold md:text-2xl">
          Videos
        </span>
        <ScrollContainer isButtonsVisible={false}>
          <div className="flex items-center justify-center gap-3">
            <SkeletonGrid
              count={6}
              itemClassName="bg-accent aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
            />
          </div>
        </ScrollContainer>
      </div>
      <div className="flex flex-col gap-5 py-3 pb-32">
        <span className="font-heading w-fit text-xl font-semibold md:text-2xl">
          Images
        </span>
        <div className="flex flex-col gap-3">
          <span className="w-fit text-lg md:text-xl">Backdrops</span>
          <ScrollContainer isButtonsVisible={false}>
            <div className="flex items-center justify-center gap-3">
              <SkeletonGrid
                count={6}
                itemClassName="bg-accent aspect-video h-44 w-auto rounded-xl md:h-52 lg:h-60"
              />
            </div>
          </ScrollContainer>
          <span className="font-heading w-fit text-lg md:text-xl">Posters</span>
          <ScrollContainer isButtonsVisible={false}>
            <div className="flex items-center justify-center gap-3">
              <SkeletonGrid
                count={12}
                itemClassName="bg-accent aspect-video h-44 w-30 rounded-xl md:h-52 md:w-35.75 lg:h-60 lg:w-41.25"
              />
            </div>
          </ScrollContainer>
        </div>
      </div>
    </>
  );
};
