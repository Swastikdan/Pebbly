import type { ComponentType } from "react";
import { useUser } from "@clerk/react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertCircle,
  Check,
  Clock,
  Eye,
  History,
  ListPlus,
  Pencil,
  RotateCcw,
  Star,
  Trash2,
} from "@/components/ui/hugeicons";
import { ModalHeader } from "@/components/ui/modal-parts";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/lib/query/keys";
import { cn, logError } from "@/lib/utils";
import {
  getWatchlistActivity,
  getWatchlistSnapshots,
  restoreWatchlistSnapshot,
  undoWatchlistActivity,
} from "@/server/fns/library";
import { unwrap } from "@/server/schema/common";

type ActionMeta = {
  label: string;
  Icon: ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>;
  tone: string;
};

function actionMeta(action: string): ActionMeta {
  switch (action) {
    case "added":
      return {
        label: "Added",
        Icon: ListPlus,
        tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    case "removed":
      return {
        label: "Removed",
        Icon: Trash2,
        tone: "bg-red-500/10 text-red-600 dark:text-red-400",
      };
    case "rated":
      return {
        label: "Rated",
        Icon: Star,
        tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };
    case "watched":
      return {
        label: "Marked watched",
        Icon: Eye,
        tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      };
    default:
      return {
        label: "Status changed",
        Icon: Pencil,
        tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      };
  }
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

function formatRelative(value: string | number | Date) {
  const date = new Date(value);
  const diffSeconds = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return "Just now";
  if (abs < 3600)
    return relativeFormatter.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400)
    return relativeFormatter.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 7)
    return relativeFormatter.format(Math.round(diffSeconds / 86400), "day");
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-0.5">
      <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {title}
      </h2>
      {typeof count === "number" && count > 0 && (
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
      <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
        <Icon aria-hidden="true" size={18} />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-[220px] text-xs">{hint}</p>
    </div>
  );
}

export function WatchlistActivityPanel() {
  const { isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const activity = useQuery({
    queryKey: queryKeys.watchlist.activity(user?.id),
    queryFn: () => unwrap(getWatchlistActivity({ data: { limit: 20 } })),
    enabled: isSignedIn && open,
  });
  const snapshots = useQuery({
    queryKey: queryKeys.watchlist.snapshots(user?.id),
    queryFn: () => unwrap(getWatchlistSnapshots({ data: { limit: 10 } })),
    enabled: isSignedIn && open,
  });

  if (!isSignedIn) return null;

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.watchlist.activity(user?.id),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.watchlist.snapshots(user?.id),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.watchlist.list(undefined, user?.id),
    });
  };

  const activityItems = activity.data?.items ?? [];
  const snapshotItems = snapshots.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5 text-xs"
          />
        }
      >
        <History aria-hidden="true" size={14} />
        <span className="hidden sm:inline">Activity & recovery</span>
        <span className="sm:hidden">Activity</span>
      </DialogTrigger>
      <DialogPopup className="flex h-[min(600px,90vh)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <ModalHeader
          icon={History}
          title="Activity & recovery"
          subtitle="Undo recent changes or restore your watchlist from a snapshot."
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_280px] md:overflow-hidden">
          {/* Recent activity */}
          <section className="flex min-h-0 flex-col p-4 sm:p-5 md:overflow-y-auto">
            <SectionHeading
              title="Recent activity"
              count={activityItems.length}
            />
            {activity.isPending && <ListSkeleton rows={5} />}
            {activity.error && (
              <div className="text-destructive bg-destructive/5 flex items-center gap-2 rounded-lg border border-current/20 px-3 py-2.5 text-xs">
                <AlertCircle aria-hidden="true" size={14} />
                Could not load activity.
              </div>
            )}
            {activity.data && activityItems.length === 0 && (
              <EmptyState
                icon={Clock}
                title="No activity yet"
                hint="Adds, ratings and status changes will show up here."
              />
            )}
            <ol className="grid gap-1">
              {activityItems.map((item) => {
                const { label, Icon, tone } = actionMeta(item.action);
                const reverted = Boolean(item.revertedAt);
                return (
                  <li
                    key={item.id}
                    className="hover:bg-muted/60 group flex items-center gap-3 rounded-xl p-2 transition-colors"
                  >
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        tone,
                        reverted && "opacity-50 grayscale",
                      )}
                    >
                      <Icon aria-hidden="true" size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm leading-tight font-medium",
                          reverted && "text-muted-foreground line-through",
                        )}
                      >
                        {item.title ?? `Title ${item.tmdbId}`}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {label} ·{" "}
                        <time
                          dateTime={new Date(item.createdAt).toISOString()}
                          title={new Date(item.createdAt).toLocaleString()}
                        >
                          {formatRelative(item.createdAt)}
                        </time>
                      </p>
                    </div>
                    {reverted ? (
                      <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                        <Check aria-hidden="true" size={12} />
                        Undone
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          void unwrap(
                            undoWatchlistActivity({
                              data: { activityId: item.id },
                            }),
                          )
                            .then(refresh)
                            .catch((error) =>
                              logError("undo watchlist activity", error),
                            );
                        }}
                      >
                        <RotateCcw aria-hidden="true" size={12} />
                        Undo
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Snapshots */}
          <section className="bg-muted/30 flex min-h-0 flex-col border-t p-4 sm:p-5 md:overflow-y-auto md:border-s md:border-t-0">
            <SectionHeading title="Snapshots" count={snapshotItems.length} />
            {snapshots.isPending && <ListSkeleton rows={3} />}
            {snapshots.data && snapshotItems.length === 0 && (
              <EmptyState
                icon={History}
                title="No snapshots yet"
                hint="Backups of your watchlist will appear here."
              />
            )}
            <ol className="grid gap-2">
              {snapshotItems.map((snapshot) => (
                <li
                  key={snapshot.id}
                  className="bg-background flex items-center gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-tight font-medium">
                      {formatRelative(snapshot.createdAt)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {snapshot.itemCount}{" "}
                      {snapshot.itemCount === 1 ? "title" : "titles"} ·{" "}
                      {new Date(snapshot.createdAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      if (!window.confirm("Restore this watchlist snapshot?"))
                        return;
                      void unwrap(
                        restoreWatchlistSnapshot({
                          data: { snapshotId: snapshot.id },
                        }),
                      )
                        .then(refresh)
                        .catch((error) =>
                          logError("restore watchlist snapshot", error),
                        );
                    }}
                  >
                    <RotateCcw aria-hidden="true" size={12} />
                    Restore
                  </Button>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
