import { useUser } from "@clerk/react";
import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "@/lib/query/keys";
import type { CustomListRow, ListItemRow } from "@/lib/server-types";
import {
	createCustomList,
	createCustomListAndAddItem,
	deleteCustomList,
	getCustomLists,
	getItemLists,
	getListItems,
	toggleListItem,
	updateCustomList,
} from "@/server/fns/lists";
import { unwrap } from "@/server/schema/common";
import type { ProgressStatus, ReactionStatus } from "@/types";
import { beginOptimistic } from "./optimistic-helpers";
import { useLocalListsStore } from "./use-local-lists-store";
import { useWatchlistStore } from "./watchlist-store";

export function useCustomLists() {
	const { isSignedIn } = useUser();
	const localLists = useLocalListsStore((state) => state.lists);
	const localItems = useLocalListsStore((state) => state.listItems);
	const remote = useQuery({
		queryKey: queryKeys.lists.all(),
		queryFn: () => unwrap(getCustomLists()),
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
				visibility: list.visibility ?? undefined,
				listType: list.listType ?? undefined,
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
	const { isSignedIn } = useUser();
	const localItems = useLocalListsStore((state) => state.listItems);
	const localMediaState = useWatchlistStore((state) => state.mediaState);
	const remote = useQuery({
		queryKey: queryKeys.lists.items(listId ?? ""),
		queryFn: () => unwrap(getListItems({ data: { listId: listId! } })),
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
	const { isSignedIn } = useUser();
	const localItems = useLocalListsStore((state) => state.listItems);
	const remote = useQuery({
		queryKey: queryKeys.lists.itemLists(tmdbId, mediaType),
		queryFn: () => unwrap(getItemLists({ data: { tmdbId, mediaType } })),
		enabled: !!isSignedIn,
	});

	return useMemo(() => {
		if (isSignedIn) return remote.data ?? [];
		return localItems
			.filter((item) => item.tmdbId === tmdbId && item.mediaType === mediaType)
			.map((item) => item.listId);
	}, [isSignedIn, remote.data, tmdbId, mediaType, localItems]);
}

async function deleteCustomListOptimistic(
	queryClient: QueryClient,
	listId: string,
) {
	return beginOptimistic(queryClient, [queryKeys.lists.all()], () => {
		const current =
			(queryClient.getQueryData<CustomListRow[]>(queryKeys.lists.all()) as
				| CustomListRow[]
				| undefined) ?? [];
		queryClient.setQueryData<CustomListRow[]>(
			queryKeys.lists.all(),
			current.filter((l) => l.id !== listId),
		);
	});
}

export function useDeleteCustomList() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const deleteListLocal = useLocalListsStore((state) => state.deleteList);

	const mutation = useMutation({
		mutationFn: (listId: string) =>
			unwrap(deleteCustomList({ data: { listId } })),
		onMutate: (listId) => deleteCustomListOptimistic(queryClient, listId),
		onError: (error, _listId, rollback) => {
			console.error("Failed to delete custom list", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all() });
		},
	});

	return useCallback(
		async (listId: string) => {
			if (isSignedIn) {
				await mutation.mutateAsync(listId);
			} else {
				deleteListLocal(listId);
			}
		},
		[isSignedIn, mutation, deleteListLocal],
	);
}

type CreateListArgs = {
	name: string;
	color?: string;
	visibility?: string;
	listType?: string;
};

async function createCustomListOptimistic(
	queryClient: QueryClient,
	args: CreateListArgs,
) {
	return beginOptimistic(queryClient, [queryKeys.lists.all()], () => {
		const current =
			(queryClient.getQueryData<CustomListRow[]>(queryKeys.lists.all()) as
				| CustomListRow[]
				| undefined) ?? [];
		const now = Date.now();
		queryClient.setQueryData<CustomListRow[]>(queryKeys.lists.all(), [
			...current,
			{
				id: `optimistic_${now}`,
				userId: "optimistic",
				name: args.name,
				color: args.color ?? null,
				visibility: args.visibility ?? null,
				listType: args.listType ?? null,
				sortOrder: current.length,
				createdAt: now,
				updatedAt: now,
				previews: [],
				itemCount: 0,
			},
		]);
	});
}

export function useCreateCustomList() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const createListLocal = useLocalListsStore((state) => state.createList);

	const mutation = useMutation({
		mutationFn: (args: CreateListArgs) =>
			unwrap(createCustomList({ data: args })),
		onMutate: (args) => createCustomListOptimistic(queryClient, args),
		onError: (error, _args, rollback) => {
			console.error("Failed to create custom list", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all() });
		},
	});

	return useCallback(
		async (args: CreateListArgs) => {
			if (isSignedIn) {
				return await mutation.mutateAsync(args);
			}
			return createListLocal(
				args.name,
				args.color,
				args.visibility,
				args.listType,
			);
		},
		[isSignedIn, mutation, createListLocal],
	);
}

type CreateListAndAddArgs = CreateListArgs & {
	tmdbId: number;
	mediaType: "movie" | "tv";
	title?: string;
	image?: string;
	backdrop?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

async function createListAndAddOptimistic(
	queryClient: QueryClient,
	args: CreateListAndAddArgs,
) {
	const now = Date.now();
	const optimisticId = `optimistic_${now}`;
	return beginOptimistic(
		queryClient,
		[
			queryKeys.lists.all(),
			queryKeys.lists.items(optimisticId),
			queryKeys.lists.itemLists(args.tmdbId, args.mediaType),
		],
		() => {
			const current =
				(queryClient.getQueryData<CustomListRow[]>(queryKeys.lists.all()) as
					| CustomListRow[]
					| undefined) ?? [];
			queryClient.setQueryData<CustomListRow[]>(queryKeys.lists.all(), [
				...current,
				{
					id: optimisticId,
					userId: "optimistic",
					name: args.name,
					color: args.color ?? null,
					visibility: args.visibility ?? null,
					listType: args.listType ?? null,
					sortOrder: current.length,
					createdAt: now,
					updatedAt: now,
					previews: [args.backdrop ?? args.image].filter(Boolean) as string[],
					itemCount: 1,
				},
			]);

			const itemListsKey = queryKeys.lists.itemLists(
				args.tmdbId,
				args.mediaType,
			);
			const currentItemLists =
				(queryClient.getQueryData<string[]>(itemListsKey) as
					| string[]
					| undefined) ?? [];
			queryClient.setQueryData<string[]>(itemListsKey, [
				...currentItemLists,
				optimisticId,
			]);
		},
	);
}

export function useCreateCustomListAndAddItem() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const createListAndAddLocal = useLocalListsStore(
		(state) => state.createListAndAddItem,
	);

	const mutation = useMutation({
		mutationFn: (args: CreateListAndAddArgs) =>
			unwrap(createCustomListAndAddItem({ data: args })),
		onMutate: (args) => createListAndAddOptimistic(queryClient, args),
		onError: (error, _args, rollback) => {
			console.error("Failed to create list and add item", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all() });
			void queryClient.invalidateQueries({ queryKey: ["lists", "items"] });
			void queryClient.invalidateQueries({ queryKey: ["lists", "item-lists"] });
		},
	});

	return useCallback(
		async (args: CreateListAndAddArgs) => {
			if (isSignedIn) {
				return await mutation.mutateAsync(args);
			}
			createListAndAddLocal(args);
		},
		[isSignedIn, mutation, createListAndAddLocal],
	);
}

type UpdateListArgs = CreateListArgs & { listId: string };

async function updateCustomListOptimistic(
	queryClient: QueryClient,
	args: UpdateListArgs,
) {
	return beginOptimistic(queryClient, [queryKeys.lists.all()], () => {
		const current =
			(queryClient.getQueryData<CustomListRow[]>(queryKeys.lists.all()) as
				| CustomListRow[]
				| undefined) ?? [];
		queryClient.setQueryData<CustomListRow[]>(
			queryKeys.lists.all(),
			current.map((l) =>
				l.id === args.listId
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
	});
}

export function useUpdateCustomList() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const updateListLocal = useLocalListsStore((state) => state.updateList);

	const mutation = useMutation({
		mutationFn: (args: UpdateListArgs) =>
			unwrap(updateCustomList({ data: args })),
		onMutate: (args) => updateCustomListOptimistic(queryClient, args),
		onError: (error, _args, rollback) => {
			console.error("Failed to update custom list", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all() });
		},
	});

	return useCallback(
		async (args: UpdateListArgs) => {
			if (isSignedIn) {
				await mutation.mutateAsync(args);
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
		[isSignedIn, mutation, updateListLocal],
	);
}

type ToggleListItemArgs = {
	listId: string;
	tmdbId: number;
	mediaType: "movie" | "tv";
	title?: string;
	image?: string;
	backdrop?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

async function toggleListItemOptimistic(
	queryClient: QueryClient,
	args: ToggleListItemArgs,
) {
	const itemListsKey = queryKeys.lists.itemLists(args.tmdbId, args.mediaType);
	const itemsKey = queryKeys.lists.items(args.listId);
	return beginOptimistic(
		queryClient,
		[itemListsKey, itemsKey, queryKeys.lists.all()],
		() => {
			const currentItemLists =
				(queryClient.getQueryData<string[]>(itemListsKey) as
					| string[]
					| undefined) ?? [];
			const exists = currentItemLists.includes(args.listId);

			if (exists) {
				queryClient.setQueryData<string[]>(
					itemListsKey,
					currentItemLists.filter((id) => id !== args.listId),
				);
			} else {
				queryClient.setQueryData<string[]>(itemListsKey, [
					...currentItemLists,
					args.listId,
				]);
			}

			const currentItems =
				(queryClient.getQueryData<ListItemRow[]>(itemsKey) as
					| ListItemRow[]
					| undefined) ?? [];
			if (exists) {
				queryClient.setQueryData<ListItemRow[]>(
					itemsKey,
					currentItems.filter((i) => i.tmdbId !== args.tmdbId),
				);
			} else {
				queryClient.setQueryData<ListItemRow[]>(itemsKey, [
					...currentItems,
					{
						id: `optimistic_${Date.now()}`,
						userId: "optimistic",
						listId: args.listId,
						tmdbId: args.tmdbId,
						mediaType: args.mediaType,
						addedAt: Date.now(),
						title: args.title ?? null,
						image: args.image ?? null,
						backdrop: args.backdrop ?? null,
						rating: args.rating ?? null,
						releaseDate: args.release_date ?? null,
						overview: args.overview ?? null,
						progressStatus: null,
						reaction: null,
					} as ListItemRow,
				]);
			}

			const lists =
				(queryClient.getQueryData<CustomListRow[]>(queryKeys.lists.all()) as
					| CustomListRow[]
					| undefined) ?? [];
			queryClient.setQueryData<CustomListRow[]>(
				queryKeys.lists.all(),
				lists.map((l) =>
					l.id === args.listId
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
		},
	);
}

export function useToggleListItem() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const toggleListItemLocal = useLocalListsStore(
		(state) => state.toggleListItem,
	);

	const mutation = useMutation({
		mutationFn: (args: ToggleListItemArgs) =>
			unwrap(toggleListItem({ data: args })),
		onMutate: (args) => toggleListItemOptimistic(queryClient, args),
		onError: (error, _args, rollback) => {
			console.error("Failed to toggle list item", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all() });
			void queryClient.invalidateQueries({ queryKey: ["lists", "items"] });
			void queryClient.invalidateQueries({ queryKey: ["lists", "item-lists"] });
		},
	});

	return useCallback(
		async (args: ToggleListItemArgs) => {
			if (isSignedIn) {
				await mutation.mutateAsync(args);
			} else {
				toggleListItemLocal(args);
			}
		},
		[isSignedIn, mutation, toggleListItemLocal],
	);
}
