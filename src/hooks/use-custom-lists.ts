import { useUser } from "@clerk/react";
import {
	type QueryClient,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
import type { CustomListRow, ListItemRow } from "@/lib/server-types";
import { getCustomLists, getItemLists, getListItems } from "@/server/fns/lists";
import { unwrap } from "@/server/schema/common";
import type { ProgressStatus, ReactionStatus } from "@/types";
import type {
	CreateListAndAddArgs,
	CreateListArgs,
	ReorderItemsArgs,
	ToggleListItemArgs,
	UpdateListArgs,
} from "./custom-lists/list-optimistic";
import { reconcileListFetch } from "./pending-ops";
import { useLocalListsStore } from "./use-local-lists-store";
import { useWatchlistStore } from "./watchlist-store";

async function fetchCustomLists(
	queryClient: QueryClient,
	userId: string | undefined,
): Promise<CustomListRow[]> {
	return reconcileListFetch(
		queryClient,
		queryKeys.lists.all(userId),
		await unwrap(getCustomLists()),
	);
}

async function fetchListItems(
	queryClient: QueryClient,
	listId: string,
	userId: string | undefined,
): Promise<ListItemRow[]> {
	return reconcileListFetch(
		queryClient,
		queryKeys.lists.items(listId, userId),
		await unwrap(getListItems({ data: { listId } })),
	);
}

async function fetchItemLists(
	queryClient: QueryClient,
	tmdbId: number,
	mediaType: "movie" | "tv",
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

export function useCustomListItems(listId: string | null) {
	const { isSignedIn, user } = useUser();
	const queryClient = useQueryClient();
	const localItems = useLocalListsStore((state) => state.listItems);
	const localMediaState = useWatchlistStore((state) => state.mediaState);
	const remote = useQuery({
		queryKey: queryKeys.lists.items(listId ?? "", user?.id),
		queryFn: () =>
			listId
				? fetchListItems(queryClient, listId, user?.id)
				: Promise.resolve([]),
		enabled: !!isSignedIn && !!listId,
	});

	return useMemo(() => {
		if (isSignedIn) {
			return (remote.data ?? []).map((item) => ({
				...item,
				_id: item.id,
				title: item.title ?? undefined,
				image: item.image ?? undefined,
				backdrop: item.backdrop ?? undefined,
				rating: item.rating ?? undefined,
				release_date: item.releaseDate ?? undefined,
				overview: item.overview ?? undefined,
				position: item.position,
				mediaType: item.mediaType as "movie" | "tv",
				progressStatus: item.progressStatus as ProgressStatus | undefined,
				reaction: item.reaction as ReactionStatus | undefined,
			}));
		}
		if (!listId) return [];

		const filtered = localItems
			.filter((item) => item.listId === listId)
			.sort(
				(a, b) =>
					(a.position ?? 0) - (b.position ?? 0) || a.addedAt - b.addedAt,
			);
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
	}, [isSignedIn, remote.data, listId, localItems, localMediaState]);
}

export function useItemLists(tmdbId: number, mediaType: "movie" | "tv") {
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
export function useDeleteCustomList() {
	const repository = useRepository();

	return useCallback(
		async (listId: string) => {
			await repository.deleteList(listId);
		},
		[repository],
	);
}

export function useCreateCustomList() {
	const repository = useRepository();

	return useCallback(
		async (args: CreateListArgs) => {
			return await repository.createList(args);
		},
		[repository],
	);
}

export function useCreateCustomListAndAddItem() {
	const repository = useRepository();

	return useCallback(
		async (args: CreateListAndAddArgs) => {
			await repository.createListAndAddItem(args);
		},
		[repository],
	);
}

export function useUpdateCustomList() {
	const repository = useRepository();

	return useCallback(
		async (args: UpdateListArgs) => {
			await repository.updateList(args);
		},
		[repository],
	);
}

export function useToggleListItem() {
	const repository = useRepository();

	return useCallback(
		async (args: ToggleListItemArgs) => {
			return await repository.toggleListItem(args);
		},
		[repository],
	);
}

export function useReorderListItems() {
	const repository = useRepository();

	return useCallback(
		async (args: ReorderItemsArgs) => {
			await repository.reorderListItem(args);
		},
		[repository],
	);
}

export function useCloneList() {
	const repository = useRepository();

	return useCallback(
		async (sourceListId: string) => {
			return await repository.cloneList(sourceListId);
		},
		[repository],
	);
}
