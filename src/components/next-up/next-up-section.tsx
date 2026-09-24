import { Clock, Play, RotateCcw, Sparkles, Trash2, Tv } from "lucide-react";
import { memo } from "react";
import { Link } from "@tanstack/react-router";

import type { NextUpItem } from "@/lib/next-up-engine";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useNextUp } from "@/hooks/use-next-up";
import { toast } from "@/lib/notifications";
import { mediaDetailRoute } from "@/lib/route-helpers";
import { cn, formatMediaTitle } from "@/lib/utils";

export const NextUpSection = memo(function NextUpSection({
  className,
}: {
  className?: string;
}) {
  const { queue, topItem, isLoading, isSettled, snooze, remove } = useNextUp();

  if (isLoading || !isSettled) {
    return null;
  }

  if (!topItem || queue.length === 0) {
    return null;
  }

  const remainingQueue = queue.slice(1);

  const handleSnooze = (item: NextUpItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    snooze(item.id, item.type, 24);
    toast({
      title: "Snoozed for 24 hours",
      description: `"${item.title}" will temporarily hide from your Next Up queue.`,
    });
  };

  const handleRemove = async (item: NextUpItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await remove(item.id, item.type);
    toast({
      title: "Removed from Next Up",
      description: `"${item.title}" was removed from your queue.`,
    });
  };

  const topRoute = mediaDetailRoute({
    mediaType: topItem.type,
    id: topItem.id,
    slug: formatMediaTitle.encode(topItem.title),
    play: true,
  });

  const detailRoute = mediaDetailRoute({
    mediaType: topItem.type,
    id: topItem.id,
    slug: formatMediaTitle.encode(topItem.title),
    play: false,
  });

  return (
    <section
      aria-labelledby="next-up-heading"
      className={cn("space-y-4", className)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-md">
            <Play aria-hidden="true" className="size-3.5 fill-current" />
          </div>
          <h2 id="next-up-heading" className="text-h2">
            Next Up
          </h2>
          <span className="text-muted-foreground text-xs font-medium">
            ({queue.length})
          </span>
        </div>
      </div>

      {/* Featured Primary Card */}
      <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4 shadow-xs sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          {/* Media Visual */}
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg md:w-72 lg:w-80">
            {topItem.backdrop || topItem.image ? (
              <Image
                alt={topItem.title}
                src={(topItem.backdrop || topItem.image) as string}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                width={360}
                height={200}
              />
            ) : (
              <div className="bg-muted flex h-full w-full items-center justify-center">
                <Play className="text-muted-foreground/40 size-12" />
              </div>
            )}

            {/* Progress bar overlay on video thumbnail */}
            {typeof topItem.progressPercent === "number" &&
              topItem.progressPercent > 0 && (
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
                  <div
                    className="bg-primary h-full transition-[width]"
                    style={{
                      width: `${Math.min(topItem.progressPercent, 100)}%`,
                    }}
                  />
                </div>
              )}
          </div>

          {/* Details & Play Actions */}
          <div className="flex flex-1 flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {topItem.type === "tv" && topItem.nextEpisode && (
                  <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold">
                    <Tv aria-hidden="true" size={11} />
                    Season {topItem.nextEpisode.season}, Episode{" "}
                    {topItem.nextEpisode.episode}
                  </span>
                )}
                {topItem.type === "movie" &&
                  typeof topItem.progressPercent === "number" && (
                    <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
                      <RotateCcw aria-hidden="true" size={11} />
                      {Math.round(topItem.progressPercent)}% completed
                    </span>
                  )}
                {topItem.source === "daily-pick" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
                    <Sparkles aria-hidden="true" size={11} />
                    Recommended Pick
                  </span>
                )}
              </div>

              <Link
                to={detailRoute.to}
                params={detailRoute.params}
                search={detailRoute.search}
                className="hover:text-primary block transition-colors"
              >
                <h3 className="text-lg font-bold tracking-tight sm:text-xl">
                  {topItem.title}
                </h3>
              </Link>

              {topItem.overview && (
                <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed sm:text-sm">
                  {topItem.overview}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                render={
                  <Link
                    to={topRoute.to}
                    params={topRoute.params}
                    search={topRoute.search}
                  />
                }
                variant="default"
                size="sm"
                className="gap-2 font-semibold"
              >
                <Play aria-hidden="true" className="size-3.5 fill-current" />
                <span>
                  {topItem.type === "tv" && topItem.nextEpisode
                    ? `Play Episode ${topItem.nextEpisode.episode}`
                    : "Resume Playback"}
                </span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(e) => handleSnooze(topItem, e)}
                className="gap-1.5 text-xs"
                title="Hide from Next Up for 24 hours"
              >
                <Clock aria-hidden="true" size={13} />
                <span className="hidden sm:inline">Snooze</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => handleRemove(topItem, e)}
                className="text-muted-foreground hover:text-destructive-foreground hover:bg-destructive/10 size-8 p-0"
                title="Remove from Next Up"
              >
                <Trash2 aria-hidden="true" size={14} />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Remaining Queue Rail */}
      {remainingQueue.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">
            Later in Queue
          </p>
          <div className="-mx-4 flex scrollbar-none gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {remainingQueue.map((item) => {
              const itemRoute = mediaDetailRoute({
                mediaType: item.type,
                id: item.id,
                slug: formatMediaTitle.encode(item.title),
                play: true,
              });

              return (
                <div
                  key={`${item.type}:${item.id}`}
                  className="group border-border bg-card hover:border-foreground/25 relative flex w-44 shrink-0 flex-col overflow-hidden rounded-lg border transition-colors sm:w-48"
                >
                  <Link
                    to={itemRoute.to}
                    params={itemRoute.params}
                    search={itemRoute.search}
                    className="bg-muted relative block aspect-video w-full overflow-hidden"
                  >
                    {item.backdrop || item.image ? (
                      <Image
                        alt={item.title}
                        src={(item.backdrop || item.image) as string}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        width={200}
                        height={112}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Play className="text-muted-foreground/40 size-6" />
                      </div>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/10">
                      <div className="bg-primary/90 text-primary-foreground flex size-8 items-center justify-center rounded-full opacity-80 shadow-md transition-all group-hover:scale-110 group-hover:opacity-100">
                        <Play
                          aria-hidden="true"
                          className="size-3.5 translate-x-0.5 fill-current"
                        />
                      </div>
                    </div>

                    {typeof item.progressPercent === "number" && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                        <div
                          className="bg-primary h-full"
                          style={{
                            width: `${Math.min(item.progressPercent, 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col justify-between p-2.5">
                    <div className="min-w-0">
                      <h4 className="text-foreground truncate text-xs font-semibold">
                        {item.title}
                      </h4>
                      <p className="text-muted-foreground/80 mt-0.5 truncate text-[11px]">
                        {item.type === "tv" && item.nextEpisode
                          ? `S${item.nextEpisode.season} E${item.nextEpisode.episode}`
                          : `${Math.round(item.progressPercent ?? 0)}% done`}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleSnooze(item, e)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md p-1 transition-colors"
                        title="Snooze for 24h"
                      >
                        <Clock aria-hidden="true" size={12} />
                        <span className="sr-only">Snooze {item.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRemove(item, e)}
                        className="text-muted-foreground hover:text-destructive-foreground hover:bg-destructive/10 rounded-md p-1 transition-colors"
                        title="Remove from queue"
                      >
                        <Trash2 aria-hidden="true" size={12} />
                        <span className="sr-only">Remove {item.title}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
});
