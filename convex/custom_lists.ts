import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  requireCurrentUser,
  getCurrentUser,
  type WatchlistUser,
  MEDIA_TYPE_VALIDATOR,
} from "./helpers/watch_item";

export const getCustomLists = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const lists = await ctx.db
      .query("lists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const allUserListItems = await ctx.db
      .query("list_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const itemsByList = new Map<string, typeof allUserListItems>();
    for (const item of allUserListItems) {
      const listIdStr = item.listId;
      const existing = itemsByList.get(listIdStr);
      if (existing) {
        existing.push(item);
      } else {
        itemsByList.set(listIdStr, [item]);
      }
    }

    const listsWithPreviews = lists.map((list) => {
      const items = itemsByList.get(list._id) ?? [];
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

    return listsWithPreviews;
  },
});

export async function createCustomListInner(
  ctx: MutationCtx,
  userId: WatchlistUser["_id"],
  args: { name: string; color?: string; visibility?: string; listType?: string }
) {
  const existing = await ctx.db
    .query("lists")
    .withIndex("by_user_name", (q) => q.eq("userId", userId).eq("name", args.name))
    .first();
  if (existing) throw new Error("A list with this name already exists");

  const highestList = await ctx.db
    .query("lists")
    .withIndex("by_user_sort", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  const maxSort = highestList ? highestList.sortOrder : 0;

  const now = Date.now();
  return ctx.db.insert("lists", {
    userId,
    name: args.name,
    color: args.color,
    visibility: args.visibility,
    listType: args.listType,
    sortOrder: maxSort + 1,
    createdAt: now,
    updatedAt: now,
  });
}

export const createCustomList = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    visibility: v.optional(v.string()),
    listType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return createCustomListInner(ctx, user._id, args);
  },
});

export const updateCustomList = mutation({
  args: {
    listId: v.id("lists"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    visibility: v.optional(v.string()),
    listType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const list = await ctx.db.get(args.listId);
    if (!list || list.userId !== user._id) throw new Error("List not found");

    if (args.name !== undefined && args.name !== list.name) {
      const nameToCheck = args.name;
      const dup = await ctx.db
        .query("lists")
        .withIndex("by_user_name", (q) => q.eq("userId", user._id).eq("name", nameToCheck))
        .first();
      if (dup) throw new Error("A list with this name already exists");
    }

    await ctx.db.patch(args.listId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.color !== undefined ? { color: args.color } : {}),
      ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
      ...(args.listType !== undefined ? { listType: args.listType } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const deleteCustomList = mutation({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const list = await ctx.db.get(args.listId);
    if (!list || list.userId !== user._id) throw new Error("List not found");

    while (true) {
      const items = await ctx.db
        .query("list_items")
        .withIndex("by_list", (q) => q.eq("listId", args.listId))
        .take(200);
      if (items.length === 0) break;
      for (const item of items) {
        await ctx.db.delete(item._id);
      }
    }

    await ctx.db.delete(args.listId);
  },
});

export const getListItems = query({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const list = await ctx.db.get(args.listId);
    if (!list || list.userId !== user._id) return [];

    const items = await ctx.db
      .query("list_items")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();

    const watchItemPromises = items.map((item) =>
      ctx.db
        .query("watch_items")
        .withIndex("by_user_media", (q) =>
          q.eq("userId", user._id).eq("tmdbId", item.tmdbId).eq("mediaType", item.mediaType),
        )
        .first(),
    );
    const watchItems = await Promise.all(watchItemPromises);

    const watchItemMap = new Map<string, (typeof watchItems)[0]>();
    for (const w of watchItems) {
      if (w) {
        watchItemMap.set(`${w.tmdbId}_${w.mediaType}`, w);
      }
    }

    const enriched = items.map((item) => {
      const watchItem = watchItemMap.get(`${item.tmdbId}_${item.mediaType}`);

      return {
        ...item,
        title: item.title ?? watchItem?.title,
        image: item.image ?? watchItem?.image,
        rating: item.rating ?? watchItem?.rating,
        release_date: item.release_date ?? watchItem?.release_date,
        overview: item.overview ?? watchItem?.overview,
        progressStatus: watchItem?.progressStatus,
        reaction: watchItem?.reaction,
      };
    });

    return enriched;
  },
});

export const getItemLists = query({
  args: { tmdbId: v.number(), mediaType: MEDIA_TYPE_VALIDATOR },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const items = await ctx.db
      .query("list_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .collect();

    return items.map((i) => i.listId);
  },
});

export async function toggleListItemInner(
  ctx: MutationCtx,
  userId: WatchlistUser["_id"],
  args: {
    listId: Id<"lists">;
    tmdbId: number;
    mediaType: string;
    title?: string;
    image?: string;
    backdrop?: string;
    rating?: number;
    release_date?: string;
    overview?: string;
  }
) {
  const list = await ctx.db.get(args.listId);
  if (!list || list.userId !== userId) throw new Error("List not found");

  const existing = await ctx.db
    .query("list_items")
    .withIndex("by_list_media", (q) =>
      q.eq("listId", args.listId).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
    )
    .first();

  if (existing) {
    await ctx.db.delete(existing._id);
    return false;
  }

  await ctx.db.insert("list_items", {
    userId,
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
  });
  return true;
}

export const toggleListItem = mutation({
  args: {
    listId: v.id("lists"),
    tmdbId: v.number(),
    mediaType: MEDIA_TYPE_VALIDATOR,
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    backdrop: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return toggleListItemInner(ctx, user._id, args);
  },
});

export const createCustomListAndAddItem = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    visibility: v.optional(v.string()),
    listType: v.optional(v.string()),
    tmdbId: v.number(),
    mediaType: MEDIA_TYPE_VALIDATOR,
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    backdrop: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const listId = await createCustomListInner(ctx, user._id, {
      name: args.name,
      color: args.color,
      visibility: args.visibility,
      listType: args.listType,
    });

    await toggleListItemInner(ctx, user._id, {
      listId,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      title: args.title,
      image: args.image,
      backdrop: args.backdrop,
      rating: args.rating,
      release_date: args.release_date,
      overview: args.overview,
    });

    return listId;
  },
});
