import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";

const QUERY_SKIP = "skip" as const;

export function useCustomLists() {
	const { isSignedIn } = useUser();
	const lists = useQuery(
		api.watchlist.getCustomLists,
		isSignedIn ? {} : QUERY_SKIP,
	);

	return {
		lists: lists ?? [],
		loading: isSignedIn && lists === undefined,
		isAvailable: !!isSignedIn,
	};
}

export function useCustomListItems(listId: string | null) {
	const { isSignedIn } = useUser();
	const items = useQuery(
		api.watchlist.getListItems,
		isSignedIn && listId ? { listId: listId as any } : QUERY_SKIP,
	);

	return items ?? [];
}

export function useItemLists(tmdbId: number, mediaType: string) {
	const { isSignedIn } = useUser();
	const listIds = useQuery(
		api.watchlist.getItemLists,
		isSignedIn ? { tmdbId, mediaType } : QUERY_SKIP,
	);

	return listIds ?? [];
}

export function useDeleteCustomList() {
	const deleteList = useMutation(api.watchlist.deleteCustomList);

	return useCallback(
		async (listId: string) => {
			await deleteList({ listId: listId as any });
		},
		[deleteList],
	);
}
