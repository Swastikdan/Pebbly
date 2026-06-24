import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import type { ProgressStatus, ReactionStatus } from "@/types";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useLocalListsStore } from "./use-local-lists-store";
import { useWatchlistStore } from "./watchlist-store";

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
		if (isSignedIn) {
			return (remoteItems ?? []).map((item) => ({
				...item,
				mediaType: item.mediaType as "movie" | "tv",
				progressStatus: item.progressStatus as ProgressStatus | undefined,
				reaction: item.reaction as ReactionStatus | undefined,
			}));
		}
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

export function useItemLists(tmdbId: number, mediaType: "movie" | "tv") {
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

function deleteCustomListOptimisticUpdate(
	localStore: any,
	args: { listId: string },
) {
	const current = localStore.getQuery(api.watchlist.getCustomLists, {}) ?? [];
	localStore.setQuery(
		api.watchlist.getCustomLists,
		{},
		current.filter((l: any) => l._id !== args.listId),
	);
}

export function useDeleteCustomList() {
	const { isSignedIn } = useUser();
	const deleteListLocal = useLocalListsStore((state) => state.deleteList);
	const deleteList = useMutation(
		api.watchlist.deleteCustomList,
	).withOptimisticUpdate(deleteCustomListOptimisticUpdate);

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

function createCustomListOptimisticUpdate(
	localStore: any,
	args: {
		name: string;
		color?: string;
		visibility?: string;
		listType?: string;
	},
) {
	const current = localStore.getQuery(api.watchlist.getCustomLists, {}) ?? [];
	const now = Date.now();
	localStore.setQuery(api.watchlist.getCustomLists, {}, [
		...current,
		{
			_id: `optimistic_${now}`,
			name: args.name,
			color: args.color,
			visibility: args.visibility,
			listType: args.listType,
			sortOrder: current.length,
			createdAt: now,
			updatedAt: now,
			previews: [],
			itemCount: 0,
		},
	]);
}

export function useCreateCustomList() {
	const { isSignedIn } = useUser();
	const createListLocal = useLocalListsStore((state) => state.createList);
	const createList = useMutation(
		api.watchlist.createCustomList,
	).withOptimisticUpdate(createCustomListOptimisticUpdate);

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

function createListAndAddOptimisticUpdate(
	localStore: any,
	args: {
		name: string;
		color?: string;
		visibility?: string;
		listType?: string;
		tmdbId: number;
		mediaType: "movie" | "tv";
		title?: string;
		image?: string;
		backdrop?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
	},
) {
	const current = localStore.getQuery(api.watchlist.getCustomLists, {}) ?? [];
	const now = Date.now();
	const optimisticId = `optimistic_${now}`;

	localStore.setQuery(api.watchlist.getCustomLists, {}, [
		...current,
		{
			_id: optimisticId,
			name: args.name,
			color: args.color,
			visibility: args.visibility,
			listType: args.listType,
			sortOrder: current.length,
			createdAt: now,
			updatedAt: now,
			previews: [args.backdrop ?? args.image].filter(Boolean),
			itemCount: 1,
		},
	]);

	// Optimistically add item to the list items query
	const listItemsKey = { listId: optimisticId };
	const currentListItems =
		localStore.getQuery(api.watchlist.getListItems, listItemsKey) ?? [];
	localStore.setQuery(api.watchlist.getListItems, listItemsKey, [
		...currentListItems,
		{
			_id: `optimistic_item_${now}`,
			listId: optimisticId,
			tmdbId: args.tmdbId,
			mediaType: args.mediaType,
			addedAt: now,
			title: args.title,
			image: args.image,
			backdrop: args.backdrop,
			rating: args.rating,
			release_date: args.release_date,
			overview: args.overview,
		},
	]);

	// Optimistically add list to itemLists query for this media
	const itemListsKey = { tmdbId: args.tmdbId, mediaType: args.mediaType };
	const currentItemLists =
		localStore.getQuery(api.watchlist.getItemLists, itemListsKey) ?? [];
	localStore.setQuery(api.watchlist.getItemLists, itemListsKey, [
		...currentItemLists,
		optimisticId,
	]);
}

export function useCreateCustomListAndAddItem() {
	const { isSignedIn } = useUser();
	const createListAndAddLocal = useLocalListsStore(
		(state) => state.createListAndAddItem,
	);
	const createListAndAdd = useMutation(
		api.watchlist.createCustomListAndAddItem,
	).withOptimisticUpdate(createListAndAddOptimisticUpdate);

	return useCallback(
		async (args: {
			name: string;
			color?: string;
			visibility?: string;
			listType?: string;
			tmdbId: number;
			mediaType: "movie" | "tv";
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

function updateCustomListOptimisticUpdate(
	localStore: any,
	args: {
		listId: string;
		name?: string;
		color?: string;
		visibility?: string;
		listType?: string;
	},
) {
	const current = localStore.getQuery(api.watchlist.getCustomLists, {}) ?? [];
	localStore.setQuery(
		api.watchlist.getCustomLists,
		{},
		current.map((l: any) =>
			l._id === args.listId
				? {
						...l,
						...(args.name !== undefined && { name: args.name }),
						...(args.color !== undefined && { color: args.color }),
						...(args.visibility !== undefined && {
							visibility: args.visibility,
						}),
						...(args.listType !== undefined && { listType: args.listType }),
						updatedAt: Date.now(),
					}
				: l,
		),
	);
}

export function useUpdateCustomList() {
	const { isSignedIn } = useUser();
	const updateListLocal = useLocalListsStore((state) => state.updateList);
	const updateList = useMutation(
		api.watchlist.updateCustomList,
	).withOptimisticUpdate(updateCustomListOptimisticUpdate);

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

function toggleListItemOptimisticUpdate(
	localStore: any,
	args: {
		listId: string;
		tmdbId: number;
		mediaType: "movie" | "tv";
		title?: string;
		image?: string;
		backdrop?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
	},
) {
	// Update itemLists query for this media
	const itemListsKey = { tmdbId: args.tmdbId, mediaType: args.mediaType };
	const currentItemLists =
		localStore.getQuery(api.watchlist.getItemLists, itemListsKey) ?? [];
	const exists = currentItemLists.includes(args.listId);

	if (exists) {
		localStore.setQuery(
			api.watchlist.getItemLists,
			itemListsKey,
			currentItemLists.filter((id: string) => id !== args.listId),
		);
	} else {
		localStore.setQuery(api.watchlist.getItemLists, itemListsKey, [
			...currentItemLists,
			args.listId,
		]);
	}

	// Update list items query for this list
	const listItemsKey = { listId: args.listId };
	const currentListItems =
		localStore.getQuery(api.watchlist.getListItems, listItemsKey) ?? [];

	if (exists) {
		localStore.setQuery(
			api.watchlist.getListItems,
			listItemsKey,
			currentListItems.filter((i: any) => i.tmdbId !== args.tmdbId),
		);
	} else {
		localStore.setQuery(api.watchlist.getListItems, listItemsKey, [
			...currentListItems,
			{
				_id: `optimistic_${Date.now()}`,
				listId: args.listId,
				tmdbId: args.tmdbId,
				mediaType: args.mediaType,
				addedAt: Date.now(),
				title: args.title,
				image: args.image,
				backdrop: args.backdrop,
				rating: args.rating,
				release_date: args.release_date,
				overview: args.overview,
			},
		]);
	}

	// Bump itemCount on the parent list
	const customLists =
		localStore.getQuery(api.watchlist.getCustomLists, {}) ?? [];
	localStore.setQuery(
		api.watchlist.getCustomLists,
		{},
		customLists.map((l: any) =>
			l._id === args.listId
				? {
						...l,
						itemCount: exists
							? Math.max(0, (l.itemCount ?? 1) - 1)
							: (l.itemCount ?? 0) + 1,
						updatedAt: Date.now(),
					}
				: l,
		),
	);
}

export function useToggleListItem() {
	const { isSignedIn } = useUser();
	const toggleListItemLocal = useLocalListsStore(
		(state) => state.toggleListItem,
	);
	const toggleListItem = useMutation(
		api.watchlist.toggleListItem,
	).withOptimisticUpdate(toggleListItemOptimisticUpdate);

	return useCallback(
		async (args: {
			listId: string;
			tmdbId: number;
			mediaType: "movie" | "tv";
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
