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
      clerkUserId: null,
    }));

    // Cache-partition key is the Clerk sub (`clerkUserId`); `userId` is a
    // deprecated alias of the same value.
    const cacheKey = session.clerkUserId ?? session.userId ?? undefined;
    if (session.isSignedIn && cacheKey) {
      await Promise.allSettled([
        context.queryClient.ensureQueryData({
          queryKey: queryKeys.watchlist.list(undefined, cacheKey),
          queryFn: () => fetchWatchlistList(context.queryClient, cacheKey),
        }),
        context.queryClient.ensureQueryData({
          queryKey: queryKeys.lists.all(cacheKey),
          queryFn: () => fetchCustomLists(context.queryClient, cacheKey),
        }),
      ]);
    }

    return {
      isSignedIn: session.isSignedIn,
      userId: cacheKey ?? null,
      clerkUserId: cacheKey ?? null,
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
