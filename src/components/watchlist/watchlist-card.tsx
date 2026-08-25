import { ChevronRight, Sparkles } from "lucide-react";

import type { WatchlistItem } from "@/stores/watchlist-store";
import type { ProgressStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { TrashBin } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import {
  MediaChip,
  MediaMetaRow,
  MediaRowCardShell,
  releaseYearOf,
} from "@/components/watchlist/media-row-card-shell";
import { IMAGE_PREFIX } from "@/constants";
import { getProgressOption, getReactionOption } from "@/constants/watchlist";
import { toast } from "@/hooks/use-toast-store";
import { useRepository } from "@/lib/repository/use-repository";
import { formatMediaTitle } from "@/lib/utils";

// Status advances one way only: watch-later → watching → done. "done" is
// terminal on the card — no wrap-around back to watch-later.
const STATUS_ORDER: ProgressStatus[] = ["watch-later", "watching", "done"];

function handleRemove(
  e: React.MouseEvent,
  item: WatchlistItem,
  onRemoveFromWatchlist: (item: WatchlistItem) => void,
) {
  e.preventDefault();
  e.stopPropagation();
  onRemoveFromWatchlist(item);
}

export function WatchlistCard({
  item,
  onRemoveFromWatchlist,
  priority,
}: {
  item: WatchlistItem;
  onRemoveFromWatchlist: (item: WatchlistItem) => void;
  priority?: boolean;
}) {
  const progressStatus = item.progressStatus ?? "watch-later";
  const reaction = item.reaction ?? null;
  const progressOption = getProgressOption(progressStatus);
  const reactionOption =
    reaction && reaction !== "recommended" ? getReactionOption(reaction) : null;
  const isRecommended = reaction === "recommended";
  const ProgressIcon = progressOption.icon;
  const formattedTitle = formatMediaTitle.encode(item.title);
  const imageUrl = `${IMAGE_PREFIX.LQ_POSTER}${item.image}`;
  const blurSrc = item.image
    ? `${IMAGE_PREFIX.PREVIEW}${item.image}`
    : undefined;
  const year = releaseYearOf(item.release_date);

  const { setProgressStatus } = useRepository();

  const metadata = {
    title: item.title,
    image: item.image,
    rating: item.rating,
    release_date: item.release_date ?? "",
    overview: item.overview,
  };

  const statusIndex = STATUS_ORDER.indexOf(progressStatus);
  const nextStatus =
    statusIndex >= 0 && statusIndex < STATUS_ORDER.length - 1
      ? STATUS_ORDER[statusIndex + 1]
      : null;
  const nextOption = nextStatus ? getProgressOption(nextStatus) : null;

  const advanceStatus = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!nextStatus) return;

    const capturedProgress = item.progress;
    const capturedStatus = progressStatus;
    setProgressStatus(
      String(item.external_id),
      item.type,
      nextStatus,
      metadata,
      progressStatus,
    );
    toast({
      title: `Marked as ${getProgressOption(nextStatus).label}`,
      action: {
        label: "Undo",
        onClick: () =>
          setProgressStatus(
            String(item.external_id),
            item.type,
            capturedStatus,
            metadata,
            nextStatus,
            capturedProgress,
          ),
      },
    });
  };

  return (
    <MediaRowCardShell
      to={`/${item.type}/${item.external_id}/${formattedTitle}`}
      className="rounded-2xl transition-[border-color,transform] duration-150 [@media(hover:hover)]:hover:-translate-y-0.5"
      poster={
        <Image
          alt={item.title}
          className="bg-muted h-[140px] w-[93px] rounded-xl object-cover"
          height={210}
          src={imageUrl}
          blurSrc={blurSrc}
          width={140}
          priority={priority}
        />
      }
      title={item.title}
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive shrink-0 p-1.5 transition-colors"
          aria-label={`Remove ${item.title} from watchlist`}
          onClick={(e) => handleRemove(e, item, onRemoveFromWatchlist)}
        >
          <TrashBin size={14} />
        </Button>
      }
      metaRow={
        <MediaMetaRow
          mediaType={item.type}
          year={year}
          rating={item.rating}
          className="text-muted-foreground/90 dark:text-muted-foreground/75 text-[11px]"
          labelClassName="font-semibold tracking-wide uppercase"
        />
      }
      overview={item.overview}
      overviewClassName="text-muted-foreground/60"
      footer={
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {nextOption ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={advanceStatus}
              title={`${progressOption.label} — click to move to ${nextOption.label}`}
              aria-label={`Marked as ${progressOption.label}. Click to move to ${nextOption.label}.`}
              className="bg-secondary/80 text-secondary-foreground hover:bg-secondary inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium"
            >
              <ProgressIcon size={12} />
              {progressOption.label}
              <ChevronRight size={10} className="opacity-50" />
              <span className="text-muted-foreground">{nextOption.label}</span>
            </Button>
          ) : (
            <MediaChip
              icon={ProgressIcon}
              label={progressOption.label}
              title={`Marked as ${progressOption.label}`}
            />
          )}
          {isRecommended && (
            <span className="border-info/30 bg-info/15 text-info inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-medium">
              <Sparkles size={12} />
              Recommended
            </span>
          )}
          {reactionOption && (
            <MediaChip
              icon={reactionOption.icon}
              label={reactionOption.label}
              title={reactionOption.label}
            />
          )}
        </div>
      }
    />
  );
}

export function WatchlistCardSkeleton() {
  return (
    <div className="border-border/60 bg-card dark:border-border/40 relative flex animate-pulse gap-3.5 rounded-2xl border p-3.5 shadow-xs dark:shadow-none">
      <div className="bg-muted h-[140px] w-[93px] shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="bg-muted mb-2 h-4 w-3/4 rounded" />
          <div className="bg-muted mb-3 h-3 w-1/3 rounded" />
          <div className="bg-muted mb-1.5 h-3 w-full rounded" />
          <div className="bg-muted h-3 w-4/5 rounded" />
        </div>
        <div className="flex gap-2 pt-2">
          <div className="bg-muted h-6 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
