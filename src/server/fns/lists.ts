import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getCurrentUser, requireUser } from "../auth";
import { getDb, runBatch } from "../db/client";
import { listItems, lists, watchItems } from "../db/schema";
import { getEnv } from "../env";
import { bumpListsRev } from "../helpers/watch-item";
import {
	type ApiResult,
	fail,
	ok,
	type ProgressStatus,
	type Reaction,
} from "../schema/common";
import {
	createCustomListAndAddItemArgsSchema,
	createCustomListArgsSchema,
	deleteCustomListArgsSchema,
	getItemListsArgsSchema,
	getListItemsArgsSchema,
	getPublicListArgsSchema,
	reorderListItemsArgsSchema,
	toggleListItemArgsSchema,
	updateCustomListArgsSchema,
} from "../schema/lists";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getCustomLists = createServerFn({ method: "POST" }).handler(
	async (): Promise<
		ApiResult<
			Array<
				typeof lists.$inferSelect & { previews: string[]; itemCount: number }
			>
		>
	> => {
		const user = await getCurrentUser();
		if (!user) return ok([]);

		const db = getDb(getEnv());
		const userLists = await db
			.select()
			.from(lists)
			.where(eq(lists.userId, user.id))
			.orderBy(asc(lists.sortOrder));

		const allUserListItems = await db
			.select()
			.from(listItems)
			.where(eq(listItems.userId, user.id));

		const itemsByList = new Map<string, typeof allUserListItems>();
		for (const item of allUserListItems) {
			const existing = itemsByList.get(item.listId);
			if (existing) {
				existing.push(item);
			} else {
				itemsByList.set(item.listId, [item]);
			}
		}

		const listsWithPreviews = userLists.map((list) => {
			const items = itemsByList.get(list.id) ?? [];
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

		return ok(listsWithPreviews);
	},
);

export type EnrichedListItem = typeof listItems.$inferSelect & {
	title: string | null;
	image: string | null;
	rating: number | null;
	release_date: string | null;
	overview: string | null;
	progressStatus: ProgressStatus | null;
	reaction: Reaction | null;
};

export const getListItems = createServerFn({ method: "POST" })
	.validator(getListItemsArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<EnrichedListItem[]>> => {
		const user = await getCurrentUser();
		if (!user) return ok([]);

		const db = getDb(getEnv());
		const list = await db
			.select()
			.from(lists)
			.where(and(eq(lists.id, data.listId), eq(lists.userId, user.id)))
			.limit(1);

		if (list.length === 0) return ok([]);

		const items = await db
			.select()
			.from(listItems)
			.where(
				and(eq(listItems.listId, data.listId), eq(listItems.userId, user.id)),
			)
			.orderBy(asc(listItems.position), asc(listItems.addedAt));

		// Enrich with watch_item metadata. Lists have no size cap, but D1 caps
		// bound parameters at 100 per query, so the IN list is chunked — a
		// single inArray would fail for lists with >100 distinct TMDB ids.
		const tmdbIds = [...new Set(items.map((item) => item.tmdbId))];
		const watchItemRows: (typeof watchItems.$inferSelect)[] = [];
		const IDS_PER_QUERY = 90;
		for (let i = 0; i < tmdbIds.length; i += IDS_PER_QUERY) {
			const chunk = tmdbIds.slice(i, i + IDS_PER_QUERY);
			const rows = await db
				.select()
				.from(watchItems)
				.where(
					and(
						eq(watchItems.userId, user.id),
						inArray(watchItems.tmdbId, chunk),
					),
				)
				.limit(500);
			watchItemRows.push(...rows);
		}

		const watchItemMap = new Map<string, (typeof watchItems.$inferSelect)[]>();
		for (const w of watchItemRows) {
			watchItemMap.set(`${w.tmdbId}_${w.mediaType}`, [w]);
		}

		const enriched: EnrichedListItem[] = items.map((item) => {
			const watchItem = watchItemMap.get(
				`${item.tmdbId}_${item.mediaType}`,
			)?.[0];

			return {
				...item,
				title: item.title ?? watchItem?.title ?? null,
				image: item.image ?? watchItem?.image ?? null,
				rating: item.rating ?? watchItem?.rating ?? null,
				release_date: item.releaseDate ?? watchItem?.releaseDate ?? null,
				overview: item.overview ?? watchItem?.overview ?? null,
				progressStatus: watchItem?.progressStatus ?? null,
				reaction: watchItem?.reaction ?? null,
			};
		});

		return ok(enriched);
	});

export const getItemLists = createServerFn({ method: "POST" })
	.validator(getItemListsArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<string[]>> => {
		const user = await getCurrentUser();
		if (!user) return ok([]);

		const db = getDb(getEnv());
		const items = await db
			.select({ listId: listItems.listId })
			.from(listItems)
			.where(
				and(
					eq(listItems.userId, user.id),
					eq(listItems.tmdbId, data.tmdbId),
					eq(listItems.mediaType, data.mediaType),
				),
			);

		return ok(items.map((i) => i.listId));
	});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const createCustomList = createServerFn({ method: "POST" })
	.validator(createCustomListArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<string>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const result = await createCustomListInner(user.id, data);
		if (!result.ok) return result;
		return ok(result.data);
	});

export const createCustomListAndAddItem = createServerFn({ method: "POST" })
	.validator(createCustomListAndAddItemArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<string>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		// Atomic-ish: create the list and insert the item, rolling back the
		// list if the item insert fails so a failure cannot leave an empty
		// orphaned list behind.
		const db = getDb(getEnv());

		const now = Date.now();
		const id = crypto.randomUUID();

		// Fetch the next sortOrder + check duplicate name inside the same helper;
		// the unique (userId, name) index is the real guard against races.
		const existing = await db
			.select({ id: lists.id })
			.from(lists)
			.where(and(eq(lists.userId, user.id), eq(lists.name, data.name)))
			.limit(1);
		if (existing.length > 0)
			return fail("CONFLICT", "A list with this name already exists");

		const highestList = await db
			.select({ sortOrder: lists.sortOrder })
			.from(lists)
			.where(eq(lists.userId, user.id))
			.orderBy(desc(lists.sortOrder))
			.limit(1);
		const maxSort = highestList.length > 0 ? highestList[0].sortOrder : 0;

		const listVerified = await db
			.insert(lists)
			.values({
				id,
				userId: user.id,
				name: data.name,
				color: data.color,
				description: data.description,
				visibility: data.visibility,
				listType: data.listType,
				sortType: data.sortType,
				sortOrder: maxSort + 1,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing()
			.returning({ id: lists.id });

		if (listVerified.length === 0) {
			return fail("CONFLICT", "A list with this name already exists");
		}

		const itemResult = await toggleListItemInner(user.id, {
			listId: id,
			tmdbId: data.tmdbId,
			mediaType: data.mediaType,
			title: data.title,
			image: data.image,
			backdrop: data.backdrop,
			rating: data.rating,
			release_date: data.release_date,
			overview: data.overview,
		});

		if (!itemResult.ok) {
			// Roll back the just-created list so a failure cannot leave an empty
			// list behind.
			await db.delete(lists).where(eq(lists.id, id));
			return itemResult;
		}

		return ok(id);
	});

export const updateCustomList = createServerFn({ method: "POST" })
	.validator(updateCustomListArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const list = await db
			.select()
			.from(lists)
			.where(and(eq(lists.id, data.listId), eq(lists.userId, user.id)))
			.limit(1);
		if (list.length === 0) return fail("NOT_FOUND", "List not found");

		const existing = list[0];

		if (data.name !== undefined && data.name !== existing.name) {
			const dup = await db
				.select({ id: lists.id })
				.from(lists)
				.where(and(eq(lists.userId, user.id), eq(lists.name, data.name)))
				.limit(1);
			if (dup.length > 0)
				return fail("CONFLICT", "A list with this name already exists");
		}

		await db
			.update(lists)
			.set({
				...(data.name !== undefined ? { name: data.name } : {}),
				...(data.color !== undefined ? { color: data.color } : {}),
				...(data.description !== undefined
					? { description: data.description }
					: {}),
				...(data.visibility !== undefined
					? { visibility: data.visibility }
					: {}),
				...(data.listType !== undefined ? { listType: data.listType } : {}),
				...(data.sortType !== undefined ? { sortType: data.sortType } : {}),
				updatedAt: Date.now(),
			})
			.where(eq(lists.id, existing.id));

		await bumpListsRev(db, user.id);
		return ok({ ok: true });
	});
export const deleteCustomList = createServerFn({ method: "POST" })
	.validator(deleteCustomListArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const list = await db
			.select()
			.from(lists)
			.where(and(eq(lists.id, data.listId), eq(lists.userId, user.id)))
			.limit(1);
		if (list.length === 0) return fail("NOT_FOUND", "List not found");

		// Cascade via FK — the list_id FK deletes child items automatically, so a
		// single delete replaces the old per-row loop.
		await db.delete(lists).where(eq(lists.id, data.listId));
		await bumpListsRev(db, user.id);
		return ok({ ok: true });
	});
export const toggleListItem = createServerFn({ method: "POST" })
	.validator(toggleListItemArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<boolean>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const result = await toggleListItemInner(user.id, data);
		if (!result.ok) return result;
		return ok(result.data);
	});

export const reorderListItems = createServerFn({ method: "POST" })
	.validator(reorderListItemsArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const list = await db
			.select({ id: lists.id })
			.from(lists)
			.where(and(eq(lists.id, data.listId), eq(lists.userId, user.id)))
			.limit(1);
		if (list.length === 0) return fail("NOT_FOUND", "List not found");

		// Resolve the submitted (tmdbId, mediaType) order to item ids in one
		// read, then rewrite positions. Items missing from the payload keep
		// their old positions (they were filtered out of the view).
		const existing = await db
			.select({
				id: listItems.id,
				tmdbId: listItems.tmdbId,
				mediaType: listItems.mediaType,
			})
			.from(listItems)
			.where(eq(listItems.listId, data.listId));
		const idByMediaKey = new Map(
			existing.map((row) => [`${row.tmdbId}_${row.mediaType}`, row.id]),
		);

		const updates: { id: string; position: number }[] = [];
		for (let i = 0; i < data.orderedItems.length; i++) {
			const item = data.orderedItems[i];
			const id = idByMediaKey.get(`${item.tmdbId}_${item.mediaType}`);
			if (id) updates.push({ id, position: i });
		}

		// Each update binds 2 parameters, so chunk well under D1's 100
		// bound-parameter / 100-statement batch limits.
		const UPDATES_PER_BATCH = 45;
		for (let i = 0; i < updates.length; i += UPDATES_PER_BATCH) {
			const chunk = updates.slice(i, i + UPDATES_PER_BATCH);
			await runBatch(
				db,
				chunk.map((u) =>
					db
						.update(listItems)
						.set({ position: u.position })
						.where(eq(listItems.id, u.id)),
				),
			);
		}

		await bumpListsRev(db, user.id);
		return ok({ ok: true });
	});

/**
 * Public (unauthenticated) read of a single list. Only lists marked `public`
 * are visible; private lists 404 so their existence is not leaked. The payload
 * is limited to metadata stored on `list_items` — watch progress/reactions
 * live on the owner's private `watch_items` and are never joined here.
 */
export const getPublicList = createServerFn({ method: "POST" })
	.validator(getPublicListArgsSchema)
	.handler(
		async ({
			data,
		}): Promise<
			ApiResult<{
				id: string;
				name: string;
				color: string | null;
				description: string | null;
				sortType: string | null;
				createdAt: number;
				itemCount: number;
				items: Array<{
					tmdbId: number;
					mediaType: "movie" | "tv";
					title: string | null;
					image: string | null;
					backdrop: string | null;
					rating: number | null;
					releaseDate: string | null;
					overview: string | null;
					position: number;
				}>;
			}>
		> => {
			const db = getDb(getEnv());
			const list = await db
				.select()
				.from(lists)
				.where(eq(lists.id, data.listId))
				.limit(1);

			if (list.length === 0 || list[0].visibility !== "public") {
				return fail("NOT_FOUND", "List not found");
			}

			const items = await db
				.select()
				.from(listItems)
				.where(eq(listItems.listId, data.listId))
				.orderBy(asc(listItems.position), asc(listItems.addedAt));

			return ok({
				id: list[0].id,
				name: list[0].name,
				color: list[0].color,
				description: list[0].description,
				sortType: list[0].sortType,
				createdAt: list[0].createdAt,
				itemCount: items.length,
				items: items.map((item) => ({
					tmdbId: item.tmdbId,
					mediaType: item.mediaType,
					title: item.title,
					image: item.image,
					backdrop: item.backdrop,
					rating: item.rating,
					releaseDate: item.releaseDate,
					overview: item.overview,
					position: item.position,
				})),
			});
		},
	);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createCustomListInner(
	userId: string,
	args: {
		name: string;
		color?: string;
		description?: string;
		visibility?: string;
		listType?: string;
		sortType?: "unordered" | "ordered";
	},
): Promise<ApiResult<string>> {
	const db = getDb(getEnv());
	const now = Date.now();
	const id = crypto.randomUUID();

	// Duplicate-name uniqueness is enforced by the (userId, name) unique index;
	// onConflictDoNothing turns a concurrent race into a clean CONFLICT instead
	// of a TOCTOU check-then-insert. sortOrder stays best-effort max+1.
	const highestList = await db
		.select({ sortOrder: lists.sortOrder })
		.from(lists)
		.where(eq(lists.userId, userId))
		.orderBy(desc(lists.sortOrder))
		.limit(1);
	const maxSort = highestList.length > 0 ? highestList[0].sortOrder : 0;

	const inserted = await db
		.insert(lists)
		.values({
			id,
			userId,
			name: args.name,
			color: args.color,
			description: args.description,
			visibility: args.visibility,
			listType: args.listType,
			sortType: args.sortType,
			sortOrder: maxSort + 1,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing()
		.returning({ id: lists.id });

	if (inserted.length === 0) {
		return fail("CONFLICT", "A list with this name already exists");
	}
	await bumpListsRev(db, userId);
	return ok(id);
}

async function toggleListItemInner(
	userId: string,
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
): Promise<ApiResult<boolean>> {
	const db = getDb(getEnv());
	const list = await db
		.select({ id: lists.id })
		.from(lists)
		.where(and(eq(lists.id, args.listId), eq(lists.userId, userId)))
		.limit(1);
	if (list.length === 0) return fail("NOT_FOUND", "List not found");

	const existing = await db
		.select()
		.from(listItems)
		.where(
			and(
				eq(listItems.listId, args.listId),
				eq(listItems.tmdbId, args.tmdbId),
				eq(listItems.mediaType, args.mediaType),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		await db.delete(listItems).where(eq(listItems.id, existing[0].id));
		await bumpListsRev(db, userId);
		return ok(false);
	}

	// New items go to the end of the list: position = max + 1. This doubles as
	// insertion order for unordered lists and rank order for ordered ones.
	const highestPosition = await db
		.select({ position: listItems.position })
		.from(listItems)
		.where(eq(listItems.listId, args.listId))
		.orderBy(desc(listItems.position))
		.limit(1);
	const position =
		highestPosition.length > 0 ? highestPosition[0].position + 1 : 0;

	await db.insert(listItems).values({
		id: crypto.randomUUID(),
		userId,
		listId: args.listId,
		tmdbId: args.tmdbId,
		mediaType: args.mediaType,
		addedAt: Date.now(),
		position,
		title: args.title,
		image: args.image,
		backdrop: args.backdrop,
		rating: args.rating,
		releaseDate: args.release_date,
		overview: args.overview,
	});
	await bumpListsRev(db, userId);
	return ok(true);
}
