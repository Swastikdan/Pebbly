import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
	beginOp,
	type OpHandle,
	type PendingOpEntry,
	reconcileListFetch,
	scheduleSync,
} from "./pending-ops";
import { useLocalListsStore } from "./use-local-lists-store";
import { useWatchlistStore } from "./watchlist-store";

// ---------------------------------------------------------------------------
// Reads (routed through the reconciler so refetches can't clobber pending ops)
// ---------------------------------------------------------------------------

async function fetchCustomLists(): Promise<CustomListRow[]> {
	return reconcileListFetch(
		queryKeys.lists.all(),
		await unwrap(getCustomLists()),
	);
}

async function fetchListItems(listId: string): Promise<ListItemRow[]> {
	return reconcileListFetch(
		queryKeys.lists.items(listId),
		await unwrap(getListItems({ data: { listId } })),
	);
}

async function fetchItemLists(
	tmdbId: number,
	mediaType: "movie" | "tv",
): Promise<string[]> {
	return reconcileListFetch(
		queryKeys.lists.itemLists(tmdbId, mediaType),
		await unwrap(getItemLists({ data: { tmdbId, mediaType } })),
	);
}

export function useCustomLists() {
	const { isSignedIn } = useUser();
	const localLists = useLocalListsStore((state) => state.lists);
	const localItems = useLocalListsStore((state) => state.listItems);
	const remote = useQuery({
		queryKey: queryKeys.lists.all(),
		queryFn: fetchCustomLists,
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
		queryFn: () => fetchListItems(listId!),
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
		queryFn: () => fetchItemLists(tmdbId, mediaType),
		enabled: !!isSignedIn,
	});

	return useMemo(() => {
		if (isSignedIn) return remote.data ?? [];
		return localItems
			.filter((item) => item.tmdbId === tmdbId && item.mediaType === mediaType)
			.map((item) => item.listId);
	}, [isSignedIn, remote.data, tmdbId, mediaType, localItems]);
}

// ---------------------------------------------------------------------------
// Journal helpers
// ---------------------------------------------------------------------------

const listIdOf = (list: CustomListRow) => list.id;
const stringIdOf = (id: string) => id;
const itemTmdbIdOf = (item: ListItemRow) => String(item.tmdbId);

type MixedListRow = CustomListRow | ListItemRow | string;

/** Swap an optimistic list id for the server-assigned id across affected caches. */
function swapListId(
	queryClient: ReturnType<typeof useQueryClient>,
	optimisticId: string,
	realId: string,
	itemListsKey?: readonly unknown[],
) {
	const key = queryKeys.lists.all();
	const rows = queryClient.getQueryData<CustomListRow[]>(key);
	if (rows) {
		queryClient.setQueryData<CustomListRow[]>(
			key,
			rows.map((l) => (l.id === optimisticId ? { ...l, id: realId } : l)),
		);
	}
	if (itemListsKey) {
		const itemLists = queryClient.getQueryData<string[]>(itemListsKey);
		if (itemLists) {
			queryClient.setQueryData<string[]>(
				itemListsKey,
				itemLists.map((id) => (id === optimisticId ? realId : id)),
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

function beginDeleteListOp(
	queryClient: ReturnType<typeof useQueryClient>,
	listId: string,
): OpHandle {
	return beginOp(queryClient, [
		{
			key: queryKeys.lists.all(),
			touchedIds: [listId],
			idOf: listIdOf,
			apply: (rows: CustomListRow[]) => rows.filter((l) => l.id !== listId),
		},
	]);
}

export function useDeleteCustomList() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const deleteListLocal = useLocalListsStore((state) => state.deleteList);

	const mutation = useMutation({
		mutationFn: (listId: string) =>
			unwrap(deleteCustomList({ data: { listId } })),
		onMutate: (listId) => beginDeleteListOp(queryClient, listId),
		onSuccess: (_data, _listId, handle) => handle?.resolve(),
		onError: (error, _listId, handle) => {
			console.error("Failed to delete custom list", error);
			handle?.remove();
		},
		onSettled: () => {
			// Deleting a list orphans its items and their item-lists entries.
			scheduleSync(queryClient, [
				queryKeys.lists.all(),
				["lists", "items"],
				["lists", "item-lists"],
			]);
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

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

type CreateListArgs = {
	name: string;
	color?: string;
	visibility?: string;
	listType?: string;
};

function beginCreateListOp(
	queryClient: ReturnType<typeof useQueryClient>,
	args: CreateListArgs,
	optimisticId: string,
): OpHandle {
	const now = Date.now();
	return beginOp(queryClient, [
		{
			key: queryKeys.lists.all(),
			touchedIds: [optimisticId],
			idOf: listIdOf,
			apply: (rows: CustomListRow[]) => [
				...rows,
				{
					id: optimisticId,
					userId: "optimistic",
					name: args.name,
					color: args.color ?? null,
					visibility: args.visibility ?? null,
					listType: args.listType ?? null,
					sortOrder: rows.length,
					createdAt: now,
					updatedAt: now,
					previews: [],
					itemCount: 0,
				},
			],
		},
	]);
}

export function useCreateCustomList() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const createListLocal = useLocalListsStore((state) => state.createList);

	const mutation = useMutation({
		mutationFn: (args: CreateListArgs) =>
			unwrap(createCustomList({ data: args })),
		onMutate: (args) => {
			const optimisticId = `optimistic_${Date.now()}`;
			return {
				handle: beginCreateListOp(queryClient, args, optimisticId),
				optimisticId,
			};
		},
		onSuccess: (realId, _args, context) => {
			if (context?.optimisticId) {
				swapListId(queryClient, context.optimisticId, realId);
			}
			context?.handle?.resolve();
		},
		onError: (error, _args, context) => {
			console.error("Failed to create custom list", error);
			context?.handle?.remove();
		},
		onSettled: () => {
			scheduleSync(queryClient, [queryKeys.lists.all()]);
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

// ---------------------------------------------------------------------------
// Create + add item
// ---------------------------------------------------------------------------

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

function beginCreateListAndAddOp(
	queryClient: ReturnType<typeof useQueryClient>,
	args: CreateListAndAddArgs,
	optimisticId: string,
): OpHandle {
	const now = Date.now();
	const itemListsKey = queryKeys.lists.itemLists(args.tmdbId, args.mediaType);
	const entries: PendingOpEntry<MixedListRow>[] = [
		{
			key: queryKeys.lists.all(),
			touchedIds: [optimisticId],
			idOf: listIdOf as (row: MixedListRow) => string,
			apply: (rows) => [
				...(rows as CustomListRow[]),
				{
					id: optimisticId,
					userId: "optimistic",
					name: args.name,
					color: args.color ?? null,
					visibility: args.visibility ?? null,
					listType: args.listType ?? null,
					sortOrder: (rows as CustomListRow[]).length,
					createdAt: now,
					updatedAt: now,
					previews: [args.backdrop ?? args.image].filter(Boolean) as string[],
					itemCount: 1,
				},
			],
		},
		{
			key: itemListsKey,
			touchedIds: [optimisticId],
			idOf: stringIdOf as (row: MixedListRow) => string,
			apply: (rows) => {
				const current = rows as string[];
				return current.includes(optimisticId)
					? current
					: [...current, optimisticId];
			},
		},
	];
	return beginOp(queryClient, entries);
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
		onMutate: (args) => {
			const optimisticId = `optimistic_${Date.now()}`;
			return {
				handle: beginCreateListAndAddOp(queryClient, args, optimisticId),
				optimisticId,
			};
		},
		onSuccess: (realId, args, context) => {
			if (context?.optimisticId) {
				swapListId(
					queryClient,
					context.optimisticId,
					realId,
					queryKeys.lists.itemLists(args.tmdbId, args.mediaType),
				);
			}
			context?.handle?.resolve();
		},
		onError: (error, _args, context) => {
			console.error("Failed to create list and add item", error);
			context?.handle?.remove();
		},
		onSettled: () => {
			scheduleSync(queryClient, [
				queryKeys.lists.all(),
				["lists", "items"],
				["lists", "item-lists"],
			]);
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

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

type UpdateListArgs = CreateListArgs & { listId: string };

function beginUpdateListOp(
	queryClient: ReturnType<typeof useQueryClient>,
	args: UpdateListArgs,
): OpHandle {
	return beginOp(queryClient, [
		{
			key: queryKeys.lists.all(),
			touchedIds: [args.listId],
			idOf: listIdOf,
			apply: (rows: CustomListRow[]) =>
				rows.map((l) =>
					l.id === args.listId
						? {
								...l,
								...(args.name !== undefined && { name: args.name }),
								...(args.color !== undefined && { color: args.color }),
								...(args.visibility !== undefined && {
									visibility: args.visibility,
								}),
								...(args.listType !== undefined && {
									listType: args.listType,
								}),
								updatedAt: Date.now(),
							}
						: l,
				),
		},
	]);
}

export function useUpdateCustomList() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const updateListLocal = useLocalListsStore((state) => state.updateList);

	const mutation = useMutation({
		mutationFn: (args: UpdateListArgs) =>
			unwrap(updateCustomList({ data: args })),
		onMutate: (args) => beginUpdateListOp(queryClient, args),
		onSuccess: (_data, _args, handle) => handle?.resolve(),
		onError: (error, _args, handle) => {
			console.error("Failed to update custom list", error);
			handle?.remove();
		},
		onSettled: () => {
			scheduleSync(queryClient, [queryKeys.lists.all()]);
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

// ---------------------------------------------------------------------------
// Toggle list item
// ---------------------------------------------------------------------------

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

type ToggleMedia = {
	listId: string;
	tmdbId: number;
	mediaType: "movie" | "tv";
};

function buildOptimisticListItem(args: ToggleListItemArgs): ListItemRow {
	return {
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
	} as ListItemRow;
}

function applyItemListsToggle(
	rows: string[],
	args: ToggleMedia,
	adding: boolean,
): string[] {
	return adding
		? rows.includes(args.listId)
			? rows
			: [...rows, args.listId]
		: rows.filter((id) => id !== args.listId);
}

function applyItemsToggle(
	rows: ListItemRow[],
	args: ToggleListItemArgs,
	adding: boolean,
): ListItemRow[] {
	if (!adding) return rows.filter((i) => i.tmdbId !== args.tmdbId);
	if (rows.some((i) => i.tmdbId === args.tmdbId)) return rows;
	return [...rows, buildOptimisticListItem(args)];
}

function applyListCountToggle(
	rows: CustomListRow[],
	args: ToggleMedia,
	adding: boolean,
): CustomListRow[] {
	return rows.map((l) =>
		l.id === args.listId
			? {
					...l,
					itemCount: adding
						? (l.itemCount ?? 0) + 1
						: Math.max(0, (l.itemCount ?? 1) - 1),
					updatedAt: Date.now(),
				}
			: l,
	);
}

function beginToggleListItemOp(
	queryClient: ReturnType<typeof useQueryClient>,
	args: ToggleListItemArgs,
): { handle: OpHandle; adding: boolean } {
	const itemListsKey = queryKeys.lists.itemLists(args.tmdbId, args.mediaType);
	const itemsKey = queryKeys.lists.items(args.listId);
	const currentItemLists = (queryClient.getQueryData<string[]>(itemListsKey) ??
		[]) as string[];
	const adding = !currentItemLists.includes(args.listId);

	const entries: PendingOpEntry<MixedListRow>[] = [
		{
			key: itemListsKey,
			touchedIds: [args.listId],
			idOf: stringIdOf as (row: MixedListRow) => string,
			apply: (rows) => applyItemListsToggle(rows as string[], args, adding),
		},
		{
			key: itemsKey,
			touchedIds: [String(args.tmdbId)],
			idOf: itemTmdbIdOf as (row: MixedListRow) => string,
			apply: (rows) => applyItemsToggle(rows as ListItemRow[], args, adding),
		},
		{
			key: queryKeys.lists.all(),
			touchedIds: [args.listId],
			idOf: listIdOf as (row: MixedListRow) => string,
			apply: (rows) =>
				applyListCountToggle(rows as CustomListRow[], args, adding),
		},
	];

	return { handle: beginOp(queryClient, entries), adding };
}

/** The server returned the authoritative new state; flip the optimistic patch if it disagreed. */
function applyToggleInverse(
	queryClient: ReturnType<typeof useQueryClient>,
	args: ToggleListItemArgs,
	adding: boolean,
) {
	const inverse = !adding;
	const itemListsKey = queryKeys.lists.itemLists(args.tmdbId, args.mediaType);
	const itemsKey = queryKeys.lists.items(args.listId);

	const itemLists = (queryClient.getQueryData<string[]>(itemListsKey) ??
		[]) as string[];
	queryClient.setQueryData<string[]>(
		itemListsKey,
		applyItemListsToggle(itemLists, args, inverse),
	);

	const items = (queryClient.getQueryData<ListItemRow[]>(itemsKey) ??
		[]) as ListItemRow[];
	queryClient.setQueryData<ListItemRow[]>(
		itemsKey,
		applyItemsToggle(items, args, inverse),
	);

	const lists = (queryClient.getQueryData<CustomListRow[]>(
		queryKeys.lists.all(),
	) ?? []) as CustomListRow[] | undefined;
	if (lists) {
		queryClient.setQueryData<CustomListRow[]>(
			queryKeys.lists.all(),
			applyListCountToggle(lists, args, inverse),
		);
	}
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
		onMutate: (args) => beginToggleListItemOp(queryClient, args),
		onSuccess: (result, args, context) => {
			if (context && result !== context.adding) {
				applyToggleInverse(queryClient, args, context.adding);
			}
			context?.handle?.resolve();
		},
		onError: (error, _args, context) => {
			console.error("Failed to toggle list item", error);
			context?.handle?.remove();
		},
		onSettled: () => {
			scheduleSync(queryClient, [
				queryKeys.lists.all(),
				["lists", "items"],
				["lists", "item-lists"],
			]);
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
