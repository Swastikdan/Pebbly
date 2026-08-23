import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import type {
  MediaDialogKey,
  MediaDialogSearch,
} from "@/lib/media-dialog-helpers";
import type { MediaType } from "@/lib/media-types";
import {
  MediaLightboxDialog,
  PlayOverlay,
  YouTubeEmbed,
} from "@/components/media/media-lightbox-dialog";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import { ArrowRightLine } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import {
  getImageDialogKey,
  updateDialogSearch,
} from "@/lib/media-dialog-helpers";

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
  const navigate = useNavigate();
  const navigateDialogSearch = (options: unknown) => navigate(options as never);

  const onUpdateDialogSearch = (key: MediaDialogKey, value?: string) =>
    updateDialogSearch(navigateDialogSearch, key, value);

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
            {" "}
            <ScrollContainer>
              <div className="flex items-center justify-center gap-3">
                {youtubeclips.map((video) => (
                  // biome-ignore lint/a11y/useSemanticElements: contains nested <button>, cannot use <button> wrapper
                  <div
                    key={video.key}
                    className="group relative cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => onUpdateDialogSearch("video", video.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onUpdateDialogSearch("video", video.key);
                      }
                    }}
                  >
                    <Image
                      alt={video.name}
                      className="bg-foreground/10 aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
                      height={450}
                      src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
                      width={300}
                    />
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
                  </div>
                ))}
                {(() => {
                  const activeVideoIndex = youtubeclips.findIndex(
                    (v) => v.key === search.video,
                  );
                  const activeVideo = youtubeclips[activeVideoIndex];
                  return (
                    <MediaLightboxDialog
                      isOpen={!!activeVideo}
                      title={activeVideo?.name ?? "Video"}
                      onClose={() => onUpdateDialogSearch("video", undefined)}
                      hasPrev={activeVideoIndex > 0}
                      hasNext={
                        activeVideoIndex >= 0 &&
                        activeVideoIndex < youtubeclips.length - 1
                      }
                      onPrev={() =>
                        onUpdateDialogSearch(
                          "video",
                          youtubeclips[activeVideoIndex - 1]?.key,
                        )
                      }
                      onNext={() =>
                        onUpdateDialogSearch(
                          "video",
                          youtubeclips[activeVideoIndex + 1]?.key,
                        )
                      }
                    >
                      {activeVideo && (
                        <div className="bg-foreground/10 size-full overflow-hidden rounded-2xl">
                          <YouTubeEmbed
                            videoKey={activeVideo.key}
                            title={activeVideo.name}
                            className="size-full rounded-2xl"
                          />
                        </div>
                      )}
                    </MediaLightboxDialog>
                  );
                })()}
                {is_more_clips_available && (
                  <Link to={mediaHref}>
                    <Button
                      className="pressable mr-10 ml-5 flex items-center justify-center rounded-lg"
                      size="lg"
                      variant="secondary"
                    >
                      View More
                      <ArrowRightLine size={24} />
                    </Button>
                  </Link>
                )}
              </div>
            </ScrollContainer>
          </TabsPanel>
        )}
        {hasBackdrops && (
          <TabsPanel value="backdrops">
            {" "}
            <ScrollContainer>
              <div className="flex items-center justify-center gap-3">
                {backdrops.map((image) => {
                  const imagePathClean = getImageDialogKey(
                    image.backdrop_image,
                  );
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: keeping div for consistent styling with other interactive containers
                    <div
                      key={`backdrop-${image.backdrop_image}`}
                      className="group relative cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        onUpdateDialogSearch("backdrop", imagePathClean)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onUpdateDialogSearch("backdrop", imagePathClean);
                        }
                      }}
                    >
                      <Image
                        alt={title}
                        className="bg-foreground/10 aspect-video h-44 w-auto rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
                        height={450}
                        src={image.backdrop_image ?? ""}
                        width={300}
                      />
                    </div>
                  );
                })}
                {(() => {
                  const activeBackdropIndex = backdrops.findIndex(
                    (b) =>
                      getImageDialogKey(b.backdrop_image) === search.backdrop,
                  );
                  const activeBackdrop = backdrops[activeBackdropIndex];
                  return (
                    <MediaLightboxDialog
                      isOpen={!!activeBackdrop}
                      title={`${title} Backdrop Image`}
                      onClose={() =>
                        onUpdateDialogSearch("backdrop", undefined)
                      }
                      hasPrev={activeBackdropIndex > 0}
                      hasNext={
                        activeBackdropIndex >= 0 &&
                        activeBackdropIndex < backdrops.length - 1
                      }
                      onPrev={() =>
                        onUpdateDialogSearch(
                          "backdrop",
                          getImageDialogKey(
                            backdrops[activeBackdropIndex - 1]?.backdrop_image,
                          ),
                        )
                      }
                      onNext={() =>
                        onUpdateDialogSearch(
                          "backdrop",
                          getImageDialogKey(
                            backdrops[activeBackdropIndex + 1]?.backdrop_image,
                          ),
                        )
                      }
                      overlayClassName="bg-white/10 backdrop-blur-lg dark:bg-black/70"
                      contentClassName="aspect-video w-full max-w-[90vw] rounded-2xl border-0 bg-secondary p-0 ring-0 gap-0 overflow-hidden"
                    >
                      {activeBackdrop && (
                        <div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-2xl p-0">
                          <Image
                            alt={title}
                            className="aspect-video size-full rounded-2xl object-cover"
                            height={300}
                            src={activeBackdrop.backdrop_image_raw ?? ""}
                            width={450}
                          />
                        </div>
                      )}
                    </MediaLightboxDialog>
                  );
                })()}
                {is_more_backdrops_available && (
                  <Link to={mediaHref}>
                    <Button
                      className="pressable mr-10 ml-5 flex items-center justify-center rounded-lg"
                      size="lg"
                      variant="secondary"
                    >
                      View More
                      <ArrowRightLine size={24} />
                    </Button>
                  </Link>
                )}
              </div>
            </ScrollContainer>
          </TabsPanel>
        )}
        {hasPosters && (
          <TabsPanel value="posters">
            {" "}
            <ScrollContainer>
              <div className="flex items-center justify-center gap-3">
                {posters.map((image) => {
                  const imagePathClean = getImageDialogKey(image.poster_image);
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: keeping div for consistent styling with other interactive containers
                    <div
                      key={`poster-${image.poster_image}`}
                      className="group relative cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        onUpdateDialogSearch("poster", imagePathClean)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onUpdateDialogSearch("poster", imagePathClean);
                        }
                      }}
                    >
                      <Image
                        alt={title}
                        className="bg-foreground/10 aspect-[2/3] h-44 w-auto rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
                        height={450}
                        src={image.poster_image ?? ""}
                        width={300}
                      />
                    </div>
                  );
                })}
                {(() => {
                  const activePosterIndex = posters.findIndex(
                    (p) => getImageDialogKey(p.poster_image) === search.poster,
                  );
                  const activePoster = posters[activePosterIndex];
                  return (
                    <MediaLightboxDialog
                      isOpen={!!activePoster}
                      title={`${title} Poster Image`}
                      onClose={() => onUpdateDialogSearch("poster", undefined)}
                      hasPrev={activePosterIndex > 0}
                      hasNext={
                        activePosterIndex >= 0 &&
                        activePosterIndex < posters.length - 1
                      }
                      onPrev={() =>
                        onUpdateDialogSearch(
                          "poster",
                          getImageDialogKey(
                            posters[activePosterIndex - 1]?.poster_image,
                          ),
                        )
                      }
                      onNext={() =>
                        onUpdateDialogSearch(
                          "poster",
                          getImageDialogKey(
                            posters[activePosterIndex + 1]?.poster_image,
                          ),
                        )
                      }
                      overlayClassName="bg-white/10 backdrop-blur-lg dark:bg-black/70"
                      contentClassName="aspect-[2/3] w-auto h-[90vh] rounded-2xl border-0 bg-secondary p-0 ring-0 gap-0 overflow-hidden"
                    >
                      {activePoster && (
                        <div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-2xl p-0">
                          <Image
                            alt={title}
                            className="aspect-[2/3] size-full rounded-2xl object-cover"
                            height={300}
                            src={activePoster.poster_image_raw ?? ""}
                            width={450}
                          />
                        </div>
                      )}
                    </MediaLightboxDialog>
                  );
                })()}
                {is_more_posters_available && (
                  <Link to={mediaHref}>
                    <Button
                      className="pressable mr-10 ml-5 flex items-center justify-center rounded-lg"
                      size="lg"
                      variant="secondary"
                    >
                      View More
                      <ArrowRightLine size={24} />
                    </Button>
                  </Link>
                )}
              </div>
            </ScrollContainer>
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
