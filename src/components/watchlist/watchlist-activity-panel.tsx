import { useUser } from "@clerk/react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/query/keys";
import { logError } from "@/lib/utils";
import {
  getWatchlistActivity,
  getWatchlistSnapshots,
  restoreWatchlistSnapshot,
  undoWatchlistActivity,
} from "@/server/fns/library";
import { unwrap } from "@/server/schema/common";

function actionLabel(action: string) {
  switch (action) {
    case "added":
      return "Added";
    case "removed":
      return "Removed";
    case "rated":
      return "Rated";
    case "watched":
      return "Marked watched";
    default:
      return "Status changed";
  }
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

  return (
    <section className="border-border bg-secondary/20 rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-3 text-start text-sm font-semibold"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>Activity & recovery</span>
        <span className="text-muted-foreground text-xs font-normal">
          {open ? "Hide" : "View timeline"}
        </span>
      </button>
      {open && (
        <div className="border-border grid gap-4 border-t p-3 md:grid-cols-[1fr_240px]">
          <div>
            <h2 className="text-xs font-semibold">Recent activity</h2>
            {activity.isPending && (
              <p className="text-muted-foreground mt-2 text-xs">
                Loading activity…
              </p>
            )}
            {activity.error && (
              <p className="text-destructive mt-2 text-xs">
                Could not load activity.
              </p>
            )}
            {activity.data && activity.data.items.length === 0 && (
              <p className="text-muted-foreground mt-2 text-xs">
                No activity yet.
              </p>
            )}
            <ol className="mt-2 grid gap-2">
              {(activity.data?.items ?? []).map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">
                      {item.title ?? `Title ${item.tmdbId}`}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {actionLabel(item.action)} ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </span>
                  {!item.revertedAt && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
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
                      Undo
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="text-xs font-semibold">Snapshots</h2>
            {snapshots.isPending && (
              <p className="text-muted-foreground mt-2 text-xs">
                Loading snapshots…
              </p>
            )}
            <ol className="mt-2 grid gap-2">
              {(snapshots.data ?? []).map((snapshot) => (
                <li
                  key={snapshot.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="min-w-0 flex-1">
                    {new Date(snapshot.createdAt).toLocaleString()} ·{" "}
                    {snapshot.itemCount} titles
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
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
                    Restore
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
