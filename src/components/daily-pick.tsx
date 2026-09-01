import { Eye, ThumbsDown } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogTrigger } from "@/components/ui/dialog";
import {
  BookMarkIcon,
  FilmIcon,
  SparklesIcon,
  Star,
} from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { WatchlistButton } from "@/components/watchlist-button";
import { useDailyPick } from "@/hooks/use-daily-pick";
import { usePermissions } from "@/hooks/use-permissions";
import { Spinner } from "./ui/spinner";

export function DailyPickButton() {
  const [isOpen, setIsOpen] = useState(false);

  const {
    hasFeature,
    loading: isPermissionsLoading,
    isSignedIn,
  } = usePermissions();
  const isVideoPlaybackEnabled = hasFeature("video-player");

  const pick = useDailyPick(isOpen);

  if (isPermissionsLoading) {
    return (
      <Button
        variant="secondary"
        size="lg"
        disabled
        className="pressable opacity-70"
        aria-hidden="true"
      >
        <FilmIcon className="text-primary mr-1.5 size-4" />
        <span>What to Watch Today</span>
      </Button>
    );
  }

  // Signed-in users need the video-player feature. Signed-out users get no
  // RBAC features at all, but the pick is still useful to them (browse,
  // shuffle, save locally), so keep the button visible. When hidden for
  // signed-in users without the feature, keep an invisible placeholder of
  // identical height so the hero below doesn't shift up.
  if (!isVideoPlaybackEnabled && isSignedIn) {
    return (
      <div
        aria-hidden="true"
        className="invisible flex h-11 items-center justify-center px-8"
      >
        <Button variant="secondary" size="lg" disabled tabIndex={-1}>
          <FilmIcon className="text-primary mr-1.5 size-4" />
          <span>What to Watch Today</span>
        </Button>
      </div>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          pick.setSelectedKey(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="secondary"
            size="lg"
            title="What to Watch Today"
            className="pressable"
          />
        }
      >
        <FilmIcon className="text-primary mr-1.5 size-4" />
        <span>What to Watch Today</span>
      </DialogTrigger>
      <DialogPopup
        className="bg-background border-border max-w-[92vw] overflow-hidden rounded-lg border p-0 shadow-none sm:max-w-lg"
        closeProps={{
          className:
            "border-border bg-background text-foreground hover:bg-muted top-3 right-3 z-30 rounded-md border p-2",
        }}
      >
        {pick.isDataLoading ? (
          <div className="flex h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="grid size-12 place-items-center rounded-lg">
              <Spinner className="text-foreground/70 size-6" />
            </div>
          </div>
        ) : pick.selectedItem ? (
          <div className="relative">
            <div className="bg-muted relative aspect-video w-full overflow-hidden">
              {pick.backdropUrl ? (
                <Image
                  alt={pick.title}
                  src={pick.backdropUrl}
                  className="h-full w-full object-cover"
                  width={600}
                  height={350}
                />
              ) : (
                <div className="h-full w-full bg-linear-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-950" />
              )}
              <div className="from-background via-background/40 absolute inset-0 hidden bg-linear-to-t to-transparent dark:block" />
              <div className="absolute inset-0 bg-black/15 dark:hidden" />
              <div className="from-background via-background/60 absolute inset-x-0 bottom-0 h-16 bg-linear-to-t to-transparent dark:hidden" />

              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 pr-12">
                {pick.selectedItem.isCurrentlyWatching ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-green-500/90 px-2.5 py-0.5 text-[11px] font-medium text-black">
                    <Eye className="size-3" />
                    Watching
                    {pick.selectedItem.watchProgress
                      ? ` (${Math.round(pick.selectedItem.watchProgress) + 1}%)`
                      : ""}
                  </span>
                ) : pick.selectedItem.isFromWatchlist ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-600/90 px-2.5 py-0.5 text-[11px] font-medium text-white">
                    <BookMarkIcon className="size-3 fill-white" />
                    From Your Watchlist
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/25 bg-black/75 px-2.5 py-0.5 text-[11px] font-medium text-blue-400">
                    <SparklesIcon className="size-3 fill-blue-400" />
                    Today's Pick
                  </span>
                )}
              </div>
            </div>

            <div className="relative -mt-10 px-4 pb-5 sm:-mt-12 sm:px-6 sm:pb-6">
              <div className="flex items-end gap-3 sm:gap-4">
                {pick.posterUrl && (
                  <Link
                    to={pick.targetPath}
                    onClick={() => setIsOpen(false)}
                    className="border-background/60 bg-muted group/poster relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity sm:w-24 [@media(hover:hover)]:hover:opacity-90"
                    title={`View ${pick.title}`}
                  >
                    <Image
                      alt={pick.title}
                      src={pick.posterUrl}
                      className="h-full w-full object-cover transition-transform duration-200 [@media(hover:hover)]:group-hover/poster:scale-105"
                      width={100}
                      height={150}
                    />
                  </Link>
                )}

                <div className="flex min-w-0 flex-1 flex-col justify-end gap-1 pb-0.5">
                  <Link
                    to={pick.targetPath}
                    onClick={() => setIsOpen(false)}
                    className="group/title inline-block"
                  >
                    <h3 className="text-foreground group-hover/title:text-primary line-clamp-2 text-lg leading-tight font-bold transition-colors sm:text-xl">
                      {pick.title}
                    </h3>
                  </Link>

                  <div className="text-meta text-muted-foreground flex flex-wrap items-center gap-1.5">
                    {pick.year && <span>{pick.year}</span>}
                    {pick.year && <span>•</span>}
                    <span className="text-[11px] font-medium">
                      {pick.mediaType === "tv" ? "TV Series" : "Movie"}
                    </span>
                    {pick.rating > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-bold">
                          <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                          {pick.rating.toFixed(1)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground mt-3 line-clamp-3 text-xs leading-relaxed sm:mt-4">
                {pick.selectedItem.overview}
              </p>

              <div className="mt-5 flex flex-col gap-2">
                {isVideoPlaybackEnabled ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Link
                        to={pick.targetPath}
                        // biome-ignore lint/suspicious/noExplicitAny: dynamic route
                        search={{ play: true } as any}
                        onClick={() => setIsOpen(false)}
                        className="flex-1"
                      >
                        {" "}
                        <Button className="bg-foreground text-background hover:bg-foreground/90 h-10 w-full rounded-md text-xs font-medium sm:h-11 sm:text-sm">
                          ▶ Watch Now
                        </Button>
                      </Link>

                      <WatchlistButton
                        id={pick.selectedItem.id}
                        image={pick.selectedItem.poster_path ?? ""}
                        media_type={pick.mediaType}
                        rating={pick.rating}
                        release_date={
                          pick.selectedItem.release_date ??
                          pick.selectedItem.first_air_date ??
                          ""
                        }
                        title={pick.title}
                        overview={pick.selectedItem.overview}
                        className="h-10 w-10 shrink-0 rounded-lg sm:h-11 sm:w-11"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={pick.handleDislike}
                        title="Dislike / Not for me (Removes from picks)"
                        className="border-border text-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15 active:text-destructive h-9 rounded-lg px-3 text-xs transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] sm:h-10"
                      >
                        <ThumbsDown className="mr-1.5 size-3.5" />
                        <span>Dislike</span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={pick.handleShuffle}
                        title="Pick Another"
                        className="border-border hover:bg-accent active:bg-accent h-9 rounded-lg px-3 text-xs transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] sm:h-10"
                      >
                        🎲 Another
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <WatchlistButton
                      id={pick.selectedItem.id}
                      image={pick.selectedItem.poster_path ?? ""}
                      media_type={pick.mediaType}
                      rating={pick.rating}
                      release_date={
                        pick.selectedItem.release_date ??
                        pick.selectedItem.first_air_date ??
                        ""
                      }
                      title={pick.title}
                      overview={pick.selectedItem.overview}
                      showLabel
                      className="h-10 w-full rounded-lg text-xs font-semibold sm:h-11 sm:text-sm"
                    />

                    <Button
                      variant="outline"
                      onClick={pick.handleDislike}
                      title="Dislike / Not for me (Removes from picks)"
                      className="border-border text-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15 active:text-destructive h-10 w-full rounded-lg px-2 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] sm:h-11 sm:text-sm"
                    >
                      <ThumbsDown className="mr-1.5 size-3.5" />
                      <span>Dislike</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={pick.handleShuffle}
                      title="Pick Another"
                      className="border-border hover:bg-accent active:bg-accent h-10 w-full rounded-lg px-2 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] sm:h-11 sm:text-sm"
                    >
                      🎲 Another
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-62.5 flex-col items-center justify-center p-8 text-center">
            <FilmIcon className="text-muted-foreground/40 mb-3 size-10" />
            <h4 className="text-foreground text-base font-semibold">
              No picks available
            </h4>
            <p className="text-muted-foreground mt-1 max-w-xs text-xs">
              All available recommendations have already been watched or marked
              as disliked.
            </p>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  );
}
