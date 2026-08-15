import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq } from "drizzle-orm";
import { getCurrentUser, requireUser } from "../auth";
import { getDb } from "../db/client";
import { listItems, lists, watchItems } from "../db/schema";
import { getEnv } from "../env";
import { type ApiResult, fail, ok } from "../schema/common";
import {
	createCustomListAndAddItemArgsSchema,
	createCustomListArgsSchema,
	deleteCustomListArgsSchema,
	getItemListsArgsSchema,
	getListItemsArgsSchema,
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
			.orderBy(asc(lists.sortOrder))
			.$withCache({ config: { ex: 15 } });

		const allUserListItems = await db
			.select()
			.from(listItems)
			.where(eq(listItems.userId, user.id))
			.$withCache({ config: { ex: 15 } });

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
	progressStatus: string | null;
	reaction: string | null;
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
			.limit(1)
			.$withCache({ config: { ex: 15 } });

		if (list.length === 0) return ok([]);

		const items = await db
			.select()
			.from(listItems)
			.where(
				and(eq(listItems.listId, data.listId), eq(listItems.userId, user.id)),
			)
			.$withCache({ config: { ex: 15 } });

		// Enrich with watch_item metadata (port of the N+1 loop — batch in one query).
		const watchItemPromises = items.map((item) =>
			db
				.select()
				.from(watchItems)
				.where(
					and(
						eq(watchItems.userId, user.id),
						eq(watchItems.tmdbId, item.tmdbId),
						eq(watchItems.mediaType, item.mediaType),
					),
				)
				.limit(1),
		);
		const watchItemRows = await Promise.all(watchItemPromises);

		const watchItemMap = new Map<string, (typeof watchItems.$inferSelect)[]>();
		for (const w of watchItemRows) {
			if (w.length > 0) {
				watchItemMap.set(`${w[0].tmdbId}_${w[0].mediaType}`, w);
			}
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
			)
			.$withCache({ config: { ex: 15 } });

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

		const id = await createCustomListInner(user.id, data);
		return ok(id);
	});

export const createCustomListAndAddItem = createServerFn({ method: "POST" })
	.validator(createCustomListAndAddItemArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<string>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const listId = await createCustomListInner(user.id, {
			name: data.name,
			color: data.color,
			visibility: data.visibility,
			listType: data.listType,
		});

		await toggleListItemInner(user.id, {
			listId,
			tmdbId: data.tmdbId,
			mediaType: data.mediaType,
			title: data.title,
			image: data.image,
			backdrop: data.backdrop,
			rating: data.rating,
			release_date: data.release_date,
			overview: data.overview,
		});

		return ok(listId);
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
				...(data.visibility !== undefined
					? { visibility: data.visibility }
					: {}),
				...(data.listType !== undefined ? { listType: data.listType } : {}),
				updatedAt: Date.now(),
			})
			.where(eq(lists.id, existing.id));

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

		// Cascade via FK, but keep the explicit loop for parity with the Convex
		// batched delete (also bounded for D1).
		while (true) {
			const items = await db
				.select({ id: listItems.id })
				.from(listItems)
				.where(eq(listItems.listId, data.listId))
				.limit(200);
			if (items.length === 0) break;
			for (const item of items) {
				await db.delete(listItems).where(eq(listItems.id, item.id));
			}
		}

		await db.delete(lists).where(eq(lists.id, data.listId));
		return ok({ ok: true });
	});

export const toggleListItem = createServerFn({ method: "POST" })
	.validator(toggleListItemArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<boolean>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		return ok(await toggleListItemInner(user.id, data));
	});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createCustomListInner(
	userId: string,
	args: {
		name: string;
		color?: string;
		visibility?: string;
		listType?: string;
	},
): Promise<string> {
	const db = getDb(getEnv());
	const existing = await db
		.select({ id: lists.id })
		.from(lists)
		.where(and(eq(lists.userId, userId), eq(lists.name, args.name)))
		.limit(1);
	if (existing.length > 0)
		throw new Error("A list with this name already exists");

	const highestList = await db
		.select({ sortOrder: lists.sortOrder })
		.from(lists)
		.where(eq(lists.userId, userId))
		.orderBy(desc(lists.sortOrder))
		.limit(1);
	const maxSort = highestList.length > 0 ? highestList[0].sortOrder : 0;

	const now = Date.now();
	const id = crypto.randomUUID();
	await db.insert(lists).values({
		id,
		userId,
		name: args.name,
		color: args.color,
		visibility: args.visibility,
		listType: args.listType,
		sortOrder: maxSort + 1,
		createdAt: now,
		updatedAt: now,
	});
	return id;
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
): Promise<boolean> {
	const db = getDb(getEnv());
	const list = await db
		.select({ id: lists.id })
		.from(lists)
		.where(and(eq(lists.id, args.listId), eq(lists.userId, userId)))
		.limit(1);
	if (list.length === 0) throw new Error("List not found");

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
		return false;
	}

	await db.insert(listItems).values({
		id: crypto.randomUUID(),
		userId,
		listId: args.listId,
		tmdbId: args.tmdbId,
		mediaType: args.mediaType,
		addedAt: Date.now(),
		title: args.title,
		image: args.image,
		backdrop: args.backdrop,
		rating: args.rating,
		releaseDate: args.release_date,
		overview: args.overview,
	});
	return true;
}
