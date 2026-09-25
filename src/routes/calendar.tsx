import { useUser } from "@clerk/react";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { DefaultEmptyState } from "@/components/default-empty-state";
import { GoBack } from "@/components/go-back";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/notifications";
import { queryKeys } from "@/lib/query/keys";
import { logError } from "@/lib/utils";
import {
  getReleaseCalendar,
  listNotifications,
  markNotificationRead,
  subscribeToRelease,
  unsubscribeFromRelease,
} from "@/server/fns/retention";
import { unwrap } from "@/server/schema/common";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const notifications = useQuery({
    queryKey: queryKeys.data.notifications(user?.id),
    queryFn: () => unwrap(listNotifications({ data: { limit: 20 } })),
    enabled: isSignedIn,
  });
  const query = useQuery({
    queryKey: queryKeys.data.releaseCalendar(user?.id),
    queryFn: () => unwrap(getReleaseCalendar()),
    enabled: isSignedIn,
  });
  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof query.data>[number][]>();
    for (const item of query.data ?? []) {
      const date = item.releaseDate ?? "Unscheduled";
      const list = map.get(date) ?? [];
      list.push(item);
      map.set(date, list);
    }
    return [...map.entries()];
  }, [query.data]);

  const toggle = async (item: NonNullable<typeof query.data>[number]) => {
    const key = `${item.mediaType}:${item.tmdbId}`;
    setPending(key);
    try {
      await unwrap(
        item.subscribed
          ? unsubscribeFromRelease({
              data: { tmdbId: item.tmdbId, mediaType: item.mediaType },
            })
          : subscribeToRelease({
              data: {
                tmdbId: item.tmdbId,
                mediaType: item.mediaType,
                title: item.title ?? undefined,
                releaseDate: item.releaseDate ?? undefined,
              },
            }),
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.data.releaseCalendar(user?.id),
      });
    } catch (error) {
      logError("update release subscription", error);
      toast({ title: "Could not update alerts", type: "error" });
    } finally {
      setPending(null);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <GoBack title="Back" />
        <h1 className="text-h1 mt-6">Release calendar</h1>
        <p className="text-muted-foreground mt-2">
          Sign in to see upcoming releases from your watchlist.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <GoBack title="Back" />
      <header>
        <h1 className="text-h1">Release calendar</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Upcoming releases and availability alerts for saved titles.
        </p>
      </header>
      {query.isPending && (
        <div className="flex justify-center py-12">
          <Spinner aria-label="Loading release calendar" />
        </div>
      )}
      {query.error && (
        <DefaultEmptyState
          message="The release calendar could not be loaded."
          onReset={() => void query.refetch()}
        />
      )}
      {!query.isPending && groups.length === 0 && (
        <DefaultEmptyState message="No upcoming saved releases yet." />
      )}
      {(notifications.data?.length ?? 0) > 0 && (
        <section className="border-primary/30 bg-primary/5 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <ul className="mt-2 grid gap-2">
            {notifications.data?.map((notification) => (
              <li
                key={notification.id}
                className="flex items-center gap-3 text-sm"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-start"
                  onClick={() => {
                    void unwrap(
                      markNotificationRead({
                        data: { notificationId: notification.id },
                      }),
                    ).then(() =>
                      queryClient.invalidateQueries({
                        queryKey: queryKeys.data.notifications(user?.id),
                      }),
                    );
                  }}
                >
                  <span className="block font-medium">
                    {notification.title}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {notification.body}
                  </span>
                </button>
                {!notification.readAt && (
                  <span className="bg-primary size-2 rounded-full">
                    <span className="sr-only">Unread</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-5">
        {groups.map(([date, items]) => (
          <section key={date} className="border-border rounded-lg border p-4">
            <h2 className="text-sm font-semibold">{date}</h2>
            <ul className="mt-3 divide-y">
              {items.map((item) => {
                const key = `${item.mediaType}:${item.tmdbId}`;
                return (
                  <li
                    key={key}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to={
                          item.mediaType === "tv"
                            ? "/series/$id/{-$slug}"
                            : "/movie/$id/{-$slug}"
                        }
                        params={{ id: String(item.tmdbId), slug: undefined }}
                        className="font-medium hover:underline"
                      >
                        {item.title ?? `Title ${item.tmdbId}`}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {item.mediaType === "tv" ? "Series" : "Movie"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={item.subscribed ? "default" : "outline"}
                      disabled={pending === key}
                      onClick={() => void toggle(item)}
                    >
                      {pending === key ? (
                        <Spinner aria-hidden="true" />
                      ) : item.subscribed ? (
                        "Alerts on"
                      ) : (
                        "Get alerts"
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
