import { useUser } from "@clerk/react";
import {
	type QueryClient,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "@/lib/query/keys";
import type { ReorderListItemInput } from "@/lib/repository/types";
import { useRepository } from "@/lib/repository/use-repository";
import type { CustomListRow, ListItemRow } from "@/lib/server-types";
import {
	clonePublicList,
	getCustomLists,
	getItemLists,
	getListItems,
} from "@/server/fns/lists";
import { unwrap } from "@/server/schema/common";
import type { ProgressStatus, ReactionStatus } from "@/types";
import type {
	CreateListAndAddArgs,
	CreateListArgs,
	ToggleListItemArgs,
	UpdateListArgs,
} from "./custom-lists/list-optimistic";
import { reconcileListFetch } from "./pending-ops";
import { useLocalListsStore } from "./use-local-lists-store";
import { useWatchlistStore } from "./watchlist-store";

// ---------------------------------------------------------------------------
// Reads (routed through the reconciler so refetches can't clobber pending ops)
// ---------------------------------------------------------------------------

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
			// Normalize the server rows to the legacy client shape (`_id`,
			// optional fields) so list consumers work unchanged.
			return (remote.data ?? []).map((list) => ({
				...list,
				_id: list.id,
				color: list.color ?? undefined,
				description: list.description ?? undefined,
				visibility: list.visibility ?? undefined,
				listType: list.listType ?? undefined,
				sortType: list.sortType ?? undefined,
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
		queryFn: () => fetchListItems(queryClient, listId!, user?.id),
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
			await repository.toggleListItem(args);
		},
		[repository],
	);
}

export function useReorderListItems() {
	const repository = useRepository();

	return useCallback(
		async (input: ReorderListItemInput) => {
			await repository.reorderListItem(input);
		},
		[repository],
	);
}

export function useClonePublicList() {
	const { isSignedIn, user } = useUser();
	const queryClient = useQueryClient();

	return useCallback(
		async (list: {
			id: string;
			name: string;
			color?: string | null;
			description?: string | null;
			sortType?: string | null;
			items: Array<{
				tmdbId: number;
				mediaType: "movie" | "tv";
				title?: string | null;
				image?: string | null;
				backdrop?: string | null;
				rating?: number | null;
				releaseDate?: string | null;
				overview?: string | null;
				position?: number;
			}>;
		}) => {
			if (isSignedIn) {
				const res = await unwrap(
					clonePublicList({ data: { listId: list.id } }),
				);
				await queryClient.invalidateQueries({
					queryKey: queryKeys.lists.all(user?.id),
				});
				return res;
			}

			// Local store fallback
			const state = useLocalListsStore.getState();
			let targetName = list.name;
			const existingNames = new Set(
				state.lists.map((l) => l.name.toLowerCase()),
			);
			if (existingNames.has(targetName.toLowerCase())) {
				let suffix = 2;
				while (existingNames.has(`${list.name} (${suffix})`.toLowerCase())) {
					suffix += 1;
				}
				targetName = `${list.name} (${suffix})`.slice(0, 50);
			}

			const newId = state.createList(
				targetName,
				list.color ?? undefined,
				list.description ?? undefined,
				"private",
				"custom",
				list.sortType ?? "unordered",
			);

			for (const item of list.items) {
				useLocalListsStore.setState((s) => ({
					listItems: [
						...s.listItems,
						{
							_id: `local_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
							listId: newId,
							tmdbId: item.tmdbId,
							mediaType: item.mediaType,
							addedAt: Date.now(),
							position: item.position ?? 0,
							title: item.title ?? undefined,
							image: item.image ?? undefined,
							backdrop: item.backdrop ?? undefined,
							rating: item.rating ?? undefined,
							release_date: item.releaseDate ?? undefined,
							overview: item.overview ?? undefined,
						},
					],
				}));
			}

			return { id: newId, name: targetName };
		},
		[isSignedIn, user?.id, queryClient],
	);
}
