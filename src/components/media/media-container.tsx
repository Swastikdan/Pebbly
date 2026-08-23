import { useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";

import type { MediaDialogSearch } from "@/lib/media-dialog-helpers";
import type { MediaType } from "@/lib/media-types";
import {
  PlayOverlay,
  YouTubeEmbed,
} from "@/components/media/media-lightbox-dialog";
import { MediaThumbRail } from "@/components/media/media-thumb-rail";
import { Button } from "@/components/ui/button";
import { ArrowRightLine } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { getImageDialogKey } from "@/lib/media-dialog-helpers";

interface VideoItem {
  key: string;
  name: string;
}

interface ImageItem {
  backdrop_image?: string;
  backdrop_image_raw?: string;
  poster_image?: string;
  poster_image_raw?: string;
}

interface MediaContainerProps {
  id: number;
  urltitle: string;
  youtubeclips: VideoItem[];
  backdrops: ImageItem[];
  posters: ImageItem[];
  title: string;
  is_more_posters_available: boolean;
  is_more_backdrops_available: boolean;
  is_more_clips_available: boolean;
  type: MediaType;
}

export const MediaContainer = (props: MediaContainerProps) => {
  const {
    id,
    urltitle,
    youtubeclips,
    backdrops,
    posters,
    title,
    is_more_posters_available,
    is_more_backdrops_available,
    is_more_clips_available,
    type,
  } = props;

  const search = useSearch({ strict: false }) as MediaDialogSearch;

  const hasVideos = youtubeclips.length > 0;
  const hasBackdrops = backdrops.length > 0;
  const hasPosters = posters.length > 0;

  const defaultSelectedKey = hasVideos
    ? "videos"
    : hasBackdrops
      ? "backdrops"
      : hasPosters
        ? "posters"
        : "videos";

  // Determine which tab should be active based on URL params
  // so that dialogs can auto-open on page reload
  const activeTabFromSearch = search.backdrop
    ? "backdrops"
    : search.poster
      ? "posters"
      : search.video
        ? "videos"
        : null;
  const [selectedTab, setSelectedTab] = useState(
    activeTabFromSearch ?? defaultSelectedKey,
  );

  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setSelectedTab(activeTabFromSearch ?? defaultSelectedKey);
  }

  const mediaHref = `/${type}/${id}/${urltitle}/media`;

  if (!hasVideos && !hasBackdrops && !hasPosters) return null;
  return (
    <div className="pb-5">
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="pb-2">
        <div className="flex items-center justify-start gap-4 pb-3">
          <Link
            className="font-heading w-fit text-lg font-semibold transition-opacity hover:opacity-70 md:text-xl"
            to={mediaHref}
          >
            Media
          </Link>
          <TabsList>
            {hasVideos && <TabsTab value="videos">Videos</TabsTab>}
            {hasBackdrops && <TabsTab value="backdrops">Backdrops</TabsTab>}
            {hasPosters && <TabsTab value="posters">Posters</TabsTab>}
          </TabsList>
        </div>
        {hasVideos && (
          <TabsPanel value="videos">
            <MediaThumbRail
              items={youtubeclips}
              paramKey="video"
              getKey={(video) => video.key}
              getThumbSrc={(video) =>
                `https://img.youtube.com/vi/${video.key}/sddefault.jpg`
              }
              getThumbAlt={(video) => video.name}
              imageClassName="bg-foreground/10 aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
              renderTileOverlay={(video) => (
                <>
                  <span className="text-foreground bg-background dark:bg-foreground dark:text-background turnicate absolute top-4 left-4 w-min max-w-[250px] truncate rounded-lg px-2 py-1 text-sm md:max-w-[300px] lg:max-w-[400px]">
                    {video.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute inset-0 size-full rounded-xl p-0 hover:bg-transparent"
                  >
                    <PlayOverlay />
                  </Button>
                </>
              )}
              getLightboxTitle={(video) => video.name}
              renderLightboxBody={(video) => (
                <div className="bg-foreground/10 size-full overflow-hidden rounded-2xl">
                  <YouTubeEmbed
                    videoKey={video.key}
                    title={video.name}
                    className="size-full rounded-2xl"
                  />
                </div>
              )}
              viewMoreHref={is_more_clips_available ? mediaHref : undefined}
            />
          </TabsPanel>
        )}
        {hasBackdrops && (
          <TabsPanel value="backdrops">
            <MediaThumbRail
              items={backdrops}
              paramKey="backdrop"
              getKey={(image) => getImageDialogKey(image.backdrop_image)}
              getThumbSrc={(image) => image.backdrop_image ?? ""}
              getThumbAlt={() => title}
              imageClassName="bg-foreground/10 aspect-video h-44 w-auto rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
              lightboxOverlayClassName="bg-white/10 backdrop-blur-lg dark:bg-black/70"
              lightboxContentClassName="aspect-video w-full max-w-[90vw] rounded-2xl border-0 bg-secondary p-0 ring-0 gap-0 overflow-hidden"
              getLightboxTitle={() => `${title} Backdrop Image`}
              renderLightboxBody={(image) => (
                <div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-2xl p-0">
                  <Image
                    alt={title}
                    className="aspect-video size-full rounded-2xl object-cover"
                    height={300}
                    src={image.backdrop_image_raw ?? ""}
                    width={450}
                  />
                </div>
              )}
              viewMoreHref={is_more_backdrops_available ? mediaHref : undefined}
            />
          </TabsPanel>
        )}
        {hasPosters && (
          <TabsPanel value="posters">
            <MediaThumbRail
              items={posters}
              paramKey="poster"
              getKey={(image) => getImageDialogKey(image.poster_image)}
              getThumbSrc={(image) => image.poster_image ?? ""}
              getThumbAlt={() => title}
              imageClassName="bg-foreground/10 aspect-[2/3] h-44 w-auto rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
              lightboxOverlayClassName="bg-white/10 backdrop-blur-lg dark:bg-black/70"
              lightboxContentClassName="aspect-[2/3] w-auto h-[90vh] rounded-2xl border-0 bg-secondary p-0 ring-0 gap-0 overflow-hidden"
              getLightboxTitle={() => `${title} Poster Image`}
              renderLightboxBody={(image) => (
                <div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-2xl p-0">
                  <Image
                    alt={title}
                    className="aspect-[2/3] size-full rounded-2xl object-cover"
                    height={300}
                    src={image.poster_image_raw ?? ""}
                    width={450}
                  />
                </div>
              )}
              viewMoreHref={is_more_posters_available ? mediaHref : undefined}
            />
          </TabsPanel>
        )}
      </Tabs>

      {(is_more_posters_available ||
        is_more_backdrops_available ||
        is_more_clips_available) && (
        <Link
          className="group text-muted-foreground hover:text-foreground w-fit text-sm font-medium transition-colors"
          to={mediaHref}
        >
          View all videos, backdrops & posters
          <ArrowRightLine
            size={14}
            className="ml-1 inline-block transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </div>
  );
};
