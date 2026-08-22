import type { QueryClient } from "@tanstack/react-query";
import type { MediaType } from "@/lib/media-types";
import { queryKeys } from "@/lib/query/keys";
import type { CustomListRow, ListItemRow } from "@/lib/server-types";
import { beginOp, type OpHandle, type PendingOpEntry } from "../pending-ops";

export const listIdOf = (list: CustomListRow) => list.id;
export const stringIdOf = (id: string) => id;
export const itemTmdbIdOf = (item: ListItemRow) => String(item.tmdbId);

export type MixedListRow = CustomListRow | ListItemRow | string;

/**
 * Swap an optimistic list id for the server-assigned id across affected
 * caches.
 */
export function swapListId(
	queryClient: QueryClient,
	optimisticId: string,
	realId: string,
	userId: string | undefined,
	itemListsKey?: readonly unknown[],
) {
	const key = queryKeys.lists.all(userId);
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

export function beginDeleteListOp(
	queryClient: QueryClient,
	listId: string,
	userId: string | undefined,
): OpHandle {
	return beginOp(
		queryClient,
		[
			{
				key: queryKeys.lists.all(userId),
				touchedIds: [listId],
				idOf: listIdOf,
				apply: (rows: CustomListRow[]) => rows.filter((l) => l.id !== listId),
			},
		],
		{ domain: "lists" },
	);
}

export type CreateListArgs = {
	name: string;
	color?: string;
	description?: string;
	visibility?: "public" | "private";
	listType?: "custom" | "pebbly-picks";
	sortType?: "unordered" | "ordered";
};

export function beginCreateListOp(
	queryClient: QueryClient,
	args: CreateListArgs,
	optimisticId: string,
	userId: string | undefined,
): OpHandle {
	const now = Date.now();
	return beginOp(
		queryClient,
		[
			{
				key: queryKeys.lists.all(userId),
				touchedIds: [optimisticId],
				idOf: listIdOf,
				apply: (rows: CustomListRow[]) => [
					...rows,
					{
						id: optimisticId,
						userId: "optimistic",
						name: args.name,
						color: args.color ?? null,
						description: args.description ?? null,
						visibility: args.visibility ?? null,
						listType: args.listType ?? null,
						sortType: args.sortType ?? "unordered",
						sortOrder: rows.length,
						createdAt: now,
						updatedAt: now,
						previews: [],
						itemCount: 0,
					},
				],
			},
		],
		{ domain: "lists" },
	);
}

export type CreateListAndAddArgs = CreateListArgs & {
	tmdbId: number;
	mediaType: MediaType;
	title?: string;
	image?: string;
	backdrop?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

export function beginCreateListAndAddOp(
	queryClient: QueryClient,
	args: CreateListAndAddArgs,
	optimisticId: string,
	userId: string | undefined,
): OpHandle {
	const now = Date.now();
	const itemListsKey = queryKeys.lists.itemLists(
		args.tmdbId,
		args.mediaType,
		userId,
	);
	const entries: PendingOpEntry<MixedListRow>[] = [
		{
			key: queryKeys.lists.all(userId),
			touchedIds: [optimisticId],
			idOf: listIdOf as (row: MixedListRow) => string,
			apply: (rows) => [
				...(rows as CustomListRow[]),
				{
					id: optimisticId,
					userId: "optimistic",
					name: args.name,
					color: args.color ?? null,
					description: args.description ?? null,
					visibility: args.visibility ?? null,
					listType: args.listType ?? null,
					sortType: args.sortType ?? "unordered",
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
	return beginOp(queryClient, entries, { domain: "lists" });
}

export type UpdateListArgs = Partial<CreateListArgs> & { listId: string };

export function beginUpdateListOp(
	queryClient: QueryClient,
	args: UpdateListArgs,
	userId: string | undefined,
): OpHandle {
	return beginOp(
		queryClient,
		[
			{
				key: queryKeys.lists.all(userId),
				touchedIds: [args.listId],
				idOf: listIdOf,
				apply: (rows: CustomListRow[]) =>
					rows.map((l) =>
						l.id === args.listId
							? {
									...l,
									...(args.name !== undefined && { name: args.name }),
									...(args.color !== undefined && { color: args.color }),
									...(args.description !== undefined && {
										description: args.description,
									}),
									...(args.visibility !== undefined && {
										visibility: args.visibility,
									}),
									...(args.listType !== undefined && {
										listType: args.listType,
									}),
									...(args.sortType !== undefined && {
										sortType: args.sortType,
									}),
									updatedAt: Date.now(),
								}
							: l,
					),
			},
		],
		{ domain: "lists" },
	);
}

export type ToggleListItemArgs = {
	listId: string;
	tmdbId: number;
	mediaType: MediaType;
	title?: string;
	image?: string;
	backdrop?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

export type ToggleMedia = {
	listId: string;
	tmdbId: number;
	mediaType: MediaType;
};

function buildOptimisticListItem(args: ToggleListItemArgs): ListItemRow {
	return {
		id: `optimistic_${Date.now()}`,
		userId: "optimistic",
		listId: args.listId,
		tmdbId: args.tmdbId,
		mediaType: args.mediaType,
		// Sorts last under `position ASC` until the server sync lands.
		position: Date.now(),
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
	// Match on both tmdbId and mediaType so a movie and TV show sharing a TMDB
	// id are never confused with one another.
	if (!adding)
		return rows.filter(
			(i) => !(i.tmdbId === args.tmdbId && i.mediaType === args.mediaType),
		);
	if (
		rows.some((i) => i.tmdbId === args.tmdbId && i.mediaType === args.mediaType)
	) {
		return rows;
	}
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

export function beginToggleListItemOp(
	queryClient: QueryClient,
	args: ToggleListItemArgs,
	userId: string | undefined,
): { handle: OpHandle; adding: boolean } {
	const itemListsKey = queryKeys.lists.itemLists(
		args.tmdbId,
		args.mediaType,
		userId,
	);
	const itemsKey = queryKeys.lists.items(args.listId, userId);
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
			key: queryKeys.lists.all(userId),
			touchedIds: [args.listId],
			idOf: listIdOf as (row: MixedListRow) => string,
			apply: (rows) =>
				applyListCountToggle(rows as CustomListRow[], args, adding),
		},
	];

	return { handle: beginOp(queryClient, entries, { domain: "lists" }), adding };
}

/**
 * The server returned the authoritative new state; flip the optimistic patch
 * if it disagreed.
 */
export function applyToggleInverse(
	queryClient: QueryClient,
	args: ToggleListItemArgs,
	adding: boolean,
	userId: string | undefined,
) {
	const inverse = !adding;
	const itemListsKey = queryKeys.lists.itemLists(
		args.tmdbId,
		args.mediaType,
		userId,
	);
	const itemsKey = queryKeys.lists.items(args.listId, userId);

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
		queryKeys.lists.all(userId),
	) ?? []) as CustomListRow[] | undefined;
	if (lists) {
		queryClient.setQueryData<CustomListRow[]>(
			queryKeys.lists.all(userId),
			applyListCountToggle(lists, args, inverse),
		);
	}
}

export type ReorderItemsArgs = {
	listId: string;
	orderedItems: Array<{ tmdbId: number; mediaType: MediaType }>;
};

/**
 * Optimistically re-sort the cached items array into the submitted order and
 * stamp matching 1-based positions, so the UI moves immediately while the
 * server write is in flight.
 */
export function beginReorderListItemsOp(
	queryClient: QueryClient,
	args: ReorderItemsArgs,
	userId: string | undefined,
): OpHandle {
	const itemsKey = queryKeys.lists.items(args.listId, userId);
	return beginOp(
		queryClient,
		[
			{
				key: itemsKey,
				touchedIds: args.orderedItems.map((entry) => String(entry.tmdbId)),
				idOf: itemTmdbIdOf,
				apply: (rows: ListItemRow[]) => {
					const rank = new Map(
						args.orderedItems.map((entry, index) => [
							`${entry.tmdbId}_${entry.mediaType}`,
							index,
						]),
					);
					return rows
						.map((row) => {
							const nextRank = rank.get(`${row.tmdbId}_${row.mediaType}`);
							return nextRank !== undefined
								? { ...row, position: nextRank + 1 }
								: row;
						})
						.sort((a, b) => {
							const rankA =
								rank.get(`${a.tmdbId}_${a.mediaType}`) ??
								Number.MAX_SAFE_INTEGER;
							const rankB =
								rank.get(`${b.tmdbId}_${b.mediaType}`) ??
								Number.MAX_SAFE_INTEGER;
							return rankA - rankB;
						});
				},
			},
		],
		{ domain: "lists" },
	);
}
