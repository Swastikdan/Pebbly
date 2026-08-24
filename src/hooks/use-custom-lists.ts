import { useUser } from "@clerk/react";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { MediaType } from "@/lib/media-types";
import type { CustomListRow } from "@/lib/server-types";
import type { QueryClient } from "@tanstack/react-query";
import { reconcileListFetch } from "@/lib/data/pending-ops";
import { queryKeys } from "@/lib/query/keys";
import { getCustomLists, getItemLists } from "@/server/fns/lists";
import { unwrap } from "@/server/schema/common";
import { useLocalListsStore } from "@/stores/local-lists-store";

/**
 * Shared queryFn for `queryKeys.lists.all(userId)`. Every consumer registering
 * that key must route through this reconciled fetcher so refetches can't
 * clobber pending ops, regardless of which hook mounted first.
 */
export async function fetchCustomLists(
  queryClient: QueryClient,
  userId: string | undefined,
): Promise<CustomListRow[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.lists.all(userId),
    await unwrap(getCustomLists()),
  );
}

async function fetchItemLists(
  queryClient: QueryClient,
  tmdbId: number,
  mediaType: MediaType,
  userId: string | undefined,
): Promise<string[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.lists.itemLists(tmdbId, mediaType, userId),
    await unwrap(getItemLists({ data: { tmdbId, mediaType } })),
  );
}

export function useCustomLists() {
  const { isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const localLists = useLocalListsStore((state) => state.lists);
  const localItems = useLocalListsStore((state) => state.listItems);
  const remote = useQuery({
    queryKey: queryKeys.lists.all(user?.id),
    queryFn: () => fetchCustomLists(queryClient, user?.id),
    enabled: !!isSignedIn,
  });

  const lists = useMemo(() => {
    if (isSignedIn) {
      return (remote.data ?? []).map((list) => ({
        ...list,
        _id: list.id,
        color: list.color ?? undefined,
        description: list.description ?? undefined,
        visibility: list.visibility ?? undefined,
        listType: list.listType ?? undefined,
        sortType: list.sortType,
      }));
    }

    return localLists.map((list) => {
      const items = localItems.filter((i) => i.listId === list._id);
      const previews = items
        .map((item) => item.backdrop ?? item.image)
        .filter((img): img is string => !!img)
        .slice(0, 4);

      return {
        ...list,
        previews,
        itemCount: items.length,
      };
    });
  }, [isSignedIn, remote.data, localLists, localItems]);

  return {
    lists,
    loading: isSignedIn && remote.isPending,
    isAvailable: true,
  };
}

export function useItemLists(tmdbId: number, mediaType: MediaType) {
  const { isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const localItems = useLocalListsStore((state) => state.listItems);
  const remote = useQuery({
    queryKey: queryKeys.lists.itemLists(tmdbId, mediaType, user?.id),
    queryFn: () => fetchItemLists(queryClient, tmdbId, mediaType, user?.id),
    enabled: !!isSignedIn,
  });

  return useMemo(() => {
    if (isSignedIn) return remote.data ?? [];
    return localItems
      .filter((item) => item.tmdbId === tmdbId && item.mediaType === mediaType)
      .map((item) => item.listId);
  }, [isSignedIn, remote.data, tmdbId, mediaType, localItems]);
}
