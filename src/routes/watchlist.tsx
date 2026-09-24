import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";

import { fetchCustomLists } from "@/hooks/use-custom-lists";
import { fetchWatchlistList } from "@/lib/data/watchlist-queries";
import { queryKeys } from "@/lib/query/keys";
import { getAuthSession } from "@/server/fns/users";
import { unwrap } from "@/server/schema/common";

export const watchlistSearchSchema = v.object({
  tab: v.optional(v.string()),
});

export type WatchlistSearch = v.InferOutput<typeof watchlistSearchSchema>;

export const Route = createFileRoute("/watchlist")({
  validateSearch: watchlistSearchSchema,
  loader: async ({ context }) => {
    const session = await unwrap(getAuthSession()).catch(() => ({
      isSignedIn: false as const,
      userId: null,
    }));

    if (session.isSignedIn && session.userId) {
      await Promise.allSettled([
        context.queryClient.ensureQueryData({
          queryKey: queryKeys.watchlist.list(
            undefined,
            session.userId ?? undefined,
          ),
          queryFn: () =>
            fetchWatchlistList(
              context.queryClient,
              session.userId ?? undefined,
            ),
        }),
        context.queryClient.ensureQueryData({
          queryKey: queryKeys.lists.all(session.userId),
          queryFn: () =>
            fetchCustomLists(context.queryClient, session.userId ?? undefined),
        }),
      ]);
    }

    return {
      isSignedIn: session.isSignedIn,
      userId: session.userId,
    };
  },
  head: () => ({
    meta: [
      { title: "Watchlist | Pebbly" },
      {
        name: "description",
        content: "Your saved movies and TV shows.",
      },
    ],
  }),
});
