import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useLocalListsStore } from "./useLocalListsStore";
import { useWatchlistStore } from "./usewatchlist";

const QUERY_SKIP = "skip" as const;

function toListId(listId: string) {
	return listId as Id<"lists">;
}

export function useCustomLists() {
	const { isSignedIn } = useUser();
	const localLists = useLocalListsStore((state) => state.lists);
	const localItems = useLocalListsStore((state) => state.listItems);
	const remoteLists = useQuery(
		api.watchlist.getCustomLists,
		isSignedIn ? {} : QUERY_SKIP,
	);

	const lists = useMemo(() => {
		if (isSignedIn) return remoteLists ?? [];

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
	}, [isSignedIn, remoteLists, localLists, localItems]);

	return {
		lists,
		loading: isSignedIn && remoteLists === undefined,
		isAvailable: true,
	};
}

export function useCustomListItems(listId: string | null) {
	const { isSignedIn } = useUser();
	const localItems = useLocalListsStore((state) => state.listItems);
	const localMediaState = useWatchlistStore((state) => state.mediaState);
	const remoteItems = useQuery(
		api.watchlist.getListItems,
		isSignedIn && listId ? { listId: toListId(listId) } : QUERY_SKIP,
	);

	return useMemo(() => {
		if (isSignedIn) return remoteItems ?? [];
		if (!listId) return [];

		const filtered = localItems.filter((item) => item.listId === listId);
		return filtered.map((item) => {
			const watchItem = localMediaState.find(
				(w) =>
					w.external_id === String(item.tmdbId) && w.type === item.mediaType,
			);
			return {
				...item,
				title: item.title ?? watchItem?.title,
				image: item.image ?? watchItem?.image,
				rating: item.rating ?? watchItem?.rating,
				release_date: item.release_date ?? watchItem?.release_date,
				overview: item.overview ?? watchItem?.overview,
				progressStatus: watchItem?.progressStatus || undefined,
				reaction: watchItem?.reaction || undefined,
			};
		});
	}, [isSignedIn, remoteItems, listId, localItems, localMediaState]);
}

export function useItemLists(tmdbId: number, mediaType: string) {
	const { isSignedIn } = useUser();
	const localItems = useLocalListsStore((state) => state.listItems);
	const remoteListIds = useQuery(
		api.watchlist.getItemLists,
		isSignedIn ? { tmdbId, mediaType } : QUERY_SKIP,
	);

	return useMemo(() => {
		if (isSignedIn) return remoteListIds ?? [];
		return localItems
			.filter((item) => item.tmdbId === tmdbId && item.mediaType === mediaType)
			.map((item) => item.listId);
	}, [isSignedIn, remoteListIds, tmdbId, mediaType, localItems]);
}

export function useDeleteCustomList() {
	const { isSignedIn } = useUser();
	const deleteListLocal = useLocalListsStore((state) => state.deleteList);
	const deleteList = useMutation(api.watchlist.deleteCustomList);

	return useCallback(
		async (listId: string) => {
			if (isSignedIn) {
				await deleteList({ listId: toListId(listId) });
			} else {
				deleteListLocal(listId);
			}
		},
		[isSignedIn, deleteList, deleteListLocal],
	);
}

export function useCreateCustomList() {
	const { isSignedIn } = useUser();
	const createListLocal = useLocalListsStore((state) => state.createList);
	const createList = useMutation(api.watchlist.createCustomList);

	return useCallback(
		async (args: {
			name: string;
			color?: string;
			visibility?: string;
			listType?: string;
		}) => {
			if (isSignedIn) {
				return await createList(args);
			}
			return createListLocal(
				args.name,
				args.color,
				args.visibility,
				args.listType,
			);
		},
		[isSignedIn, createList, createListLocal],
	);
}

export function useCreateCustomListAndAddItem() {
	const { isSignedIn } = useUser();
	const createListAndAddLocal = useLocalListsStore(
		(state) => state.createListAndAddItem,
	);
	const createListAndAdd = useMutation(
		api.watchlist.createCustomListAndAddItem,
	);

	return useCallback(
		async (args: {
			name: string;
			color?: string;
			visibility?: string;
			listType?: string;
			tmdbId: number;
			mediaType: string;
			title?: string;
			image?: string;
			backdrop?: string;
			rating?: number;
			release_date?: string;
			overview?: string;
		}) => {
			if (isSignedIn) {
				return await createListAndAdd(args);
			}
			createListAndAddLocal(args);
		},
		[isSignedIn, createListAndAdd, createListAndAddLocal],
	);
}

export function useUpdateCustomList() {
	const { isSignedIn } = useUser();
	const updateListLocal = useLocalListsStore((state) => state.updateList);
	const updateList = useMutation(api.watchlist.updateCustomList);

	return useCallback(
		async (args: {
			listId: string;
			name: string;
			color?: string;
			visibility?: string;
			listType?: string;
		}) => {
			if (isSignedIn) {
				await updateList({
					listId: toListId(args.listId),
					name: args.name,
					color: args.color,
					visibility: args.visibility,
					listType: args.listType,
				});
			} else {
				updateListLocal(
					args.listId,
					args.name,
					args.color,
					args.visibility,
					args.listType,
				);
			}
		},
		[isSignedIn, updateList, updateListLocal],
	);
}

export function useToggleListItem() {
	const { isSignedIn } = useUser();
	const toggleListItemLocal = useLocalListsStore(
		(state) => state.toggleListItem,
	);
	const toggleListItem = useMutation(api.watchlist.toggleListItem);

	return useCallback(
		async (args: {
			listId: string;
			tmdbId: number;
			mediaType: string;
			title?: string;
			image?: string;
			backdrop?: string;
			rating?: number;
			release_date?: string;
			overview?: string;
		}) => {
			if (isSignedIn) {
				await toggleListItem({
					listId: toListId(args.listId),
					tmdbId: args.tmdbId,
					mediaType: args.mediaType,
					title: args.title,
					image: args.image,
					backdrop: args.backdrop,
					rating: args.rating,
					release_date: args.release_date,
					overview: args.overview,
				});
			} else {
				toggleListItemLocal(args);
			}
		},
		[isSignedIn, toggleListItem, toggleListItemLocal],
	);
}
