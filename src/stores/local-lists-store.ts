import * as v from "valibot";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { MediaType } from "@/domain/media";
import type { PersistedStateSanitizer } from "@/stores/guest-store-kit";
import { mediaTypeSchema } from "@/server/schema/common";
import {
  guestPersistOptions,
  localId,
  mergeDefinedFields,
  nextRank,
} from "@/stores/guest-store-kit";

export type LocalList = {
  _id: string;
  name: string;
  color?: string;
  description?: string;
  visibility?: string;
  listType?: string;
  sortType?: "unordered" | "ordered";
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalListItem = {
  _id: string;
  listId: string;
  tmdbId: number;
  mediaType: MediaType;
  position?: number;
  addedAt: number;
  title?: string;
  image?: string;
  backdrop?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

interface LocalListsStore {
  lists: LocalList[];
  listItems: LocalListItem[];

  createList: (
    name: string,
    color?: string,
    visibility?: string,
    listType?: string,
    description?: string,
    sortType?: "unordered" | "ordered",
  ) => string;

  createListAndAddItem: (args: {
    name: string;
    color?: string;
    description?: string;
    visibility?: string;
    listType?: string;
    sortType?: "unordered" | "ordered";
    tmdbId: number;
    mediaType: MediaType;
    title?: string;
    image?: string;
    backdrop?: string;
    rating?: number;
    release_date?: string;
    overview?: string;
  }) => void;

  updateList: (
    listId: string,
    name?: string,
    color?: string,
    visibility?: string,
    listType?: string,
    description?: string,
    sortType?: "unordered" | "ordered",
  ) => void;

  deleteList: (listId: string) => void;

  /** Resolves true when the item was added, false when removed. */
  toggleListItem: (args: {
    listId: string;
    tmdbId: number;
    mediaType: MediaType;
    title?: string;
    image?: string;
    backdrop?: string;
    rating?: number;
    release_date?: string;
    overview?: string;
  }) => boolean;

  reorderListItem: (
    listId: string,
    orderedItems: Array<{ tmdbId: number; mediaType: MediaType }>,
  ) => void;

  cloneList: (sourceListId: string) => string;
}

const localListSchema = v.object({
  _id: v.string(),
  name: v.string(),
  color: v.optional(v.string()),
  description: v.optional(v.string()),
  visibility: v.optional(v.string()),
  listType: v.optional(v.string()),
  sortType: v.optional(v.picklist(["unordered", "ordered"])),
  sortOrder: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const localListItemSchema = v.object({
  _id: v.string(),
  listId: v.string(),
  tmdbId: v.number(),
  mediaType: mediaTypeSchema,
  position: v.optional(v.number()),
  addedAt: v.number(),
  title: v.optional(v.string()),
  image: v.optional(v.string()),
  backdrop: v.optional(v.string()),
  rating: v.optional(v.number()),
  release_date: v.optional(v.string()),
  overview: v.optional(v.string()),
});

const sanitizeLocalListsState: PersistedStateSanitizer<LocalListsStore> = (
  persisted,
) => {
  if (!persisted || typeof persisted !== "object") return null;
  const source = persisted as { lists?: unknown; listItems?: unknown };
  const lists = Array.isArray(source.lists)
    ? source.lists.flatMap((item) => {
        const parsed = v.safeParse(localListSchema, item);
        return parsed.success ? [parsed.output] : [];
      })
    : [];
  const listItems = Array.isArray(source.listItems)
    ? source.listItems.flatMap((item) => {
        const parsed = v.safeParse(localListItemSchema, item);
        return parsed.success ? [parsed.output] : [];
      })
    : [];
  return { lists, listItems };
};

function buildLocalListItem(
  args: {
    tmdbId: number;
    mediaType: MediaType;
    title?: string;
    image?: string;
    backdrop?: string;
    rating?: number;
    release_date?: string;
    overview?: string;
  },
  listId: string,
  position?: number,
): LocalListItem {
  return {
    _id: localId("item"),
    listId,
    tmdbId: args.tmdbId,
    mediaType: args.mediaType,
    position,
    addedAt: Date.now(),
    title: args.title,
    image: args.image,
    backdrop: args.backdrop,
    rating: args.rating,
    release_date: args.release_date,
    overview: args.overview,
  };
}

export const useLocalListsStore = create<LocalListsStore>()(
  persist(
    (set, get) => ({
      lists: [],
      listItems: [],

      createList: (
        name,
        color,
        visibility,
        listType,
        description,
        sortType,
      ) => {
        const id = localId("list");
        set((state) => {
          const newList: LocalList = {
            _id: id,
            name,
            color,
            description,
            visibility,
            listType,
            sortType,
            sortOrder: nextRank(
              state.lists.map((l) => l.sortOrder),
              0,
            ),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          return { lists: [...state.lists, newList] };
        });
        return id;
      },

      createListAndAddItem: (args) => {
        const listId = get().createList(
          args.name,
          args.color,
          args.visibility,
          args.listType,
          args.description,
          args.sortType,
        );

        set((state) => {
          const siblings = state.listItems.filter((i) => i.listId === listId);
          const newItem = buildLocalListItem(
            args,
            listId,
            nextRank(siblings.map((i) => i.position)),
          );

          return { listItems: [...state.listItems, newItem] };
        });
      },

      updateList: (
        listId,
        name,
        color,
        visibility,
        listType,
        description,
        sortType,
      ) =>
        set((state) => ({
          lists: state.lists.map((l) =>
            l._id === listId
              ? mergeDefinedFields(l, {
                  name,
                  color,
                  visibility,
                  listType,
                  description,
                  sortType,
                  updatedAt: Date.now(),
                })
              : l,
          ),
        })),

      deleteList: (listId) =>
        set((state) => ({
          lists: state.lists.filter((l) => l._id !== listId),
          listItems: state.listItems.filter((i) => i.listId !== listId),
        })),

      toggleListItem: (args) => {
        let added = true;
        set((state) => {
          const existingIndex = state.listItems.findIndex(
            (i) => i.listId === args.listId && i.tmdbId === args.tmdbId,
          );

          if (existingIndex !== -1) {
            added = false;
            return {
              listItems: state.listItems.filter(
                (_, idx) => idx !== existingIndex,
              ),
            };
          }

          const siblings = state.listItems.filter(
            (i) => i.listId === args.listId,
          );
          const newItem = buildLocalListItem(
            args,
            args.listId,
            nextRank(siblings.map((i) => i.position)),
          );

          return { listItems: [...state.listItems, newItem] };
        });
        return added;
      },

      reorderListItem: (listId, orderedItems) =>
        set((state) => {
          const rank = new Map(
            orderedItems.map((entry, index) => [
              `${entry.tmdbId}_${entry.mediaType}`,
              index + 1,
            ]),
          );
          return {
            listItems: state.listItems.map((item) => {
              if (item.listId !== listId) return item;
              const nextPosition = rank.get(`${item.tmdbId}_${item.mediaType}`);
              return nextPosition !== undefined
                ? { ...item, position: nextPosition }
                : item;
            }),
          };
        }),

      cloneList: (sourceListId) => {
        const state = get();
        const source = state.lists.find((l) => l._id === sourceListId);
        if (!source) return "";

        let name = `${source.name} (copy)`;
        for (let n = 2; ; n++) {
          if (!state.lists.some((l) => l.name === name)) break;
          name = `${source.name} (copy ${n})`;
        }

        const newId = localId("list");
        const now = Date.now();

        const clonedList: LocalList = {
          ...source,
          _id: newId,
          name,
          visibility: "private",
          listType: "custom",
          sortOrder: nextRank(
            state.lists.map((l) => l.sortOrder),
            0,
          ),
          createdAt: now,
          updatedAt: now,
        };

        const sourceItems = state.listItems.filter(
          (i) => i.listId === sourceListId,
        );
        const clonedItems = sourceItems.map((item, index) => ({
          ...item,
          _id: localId("item"),
          listId: newId,
          position: item.position ?? index + 1,
          addedAt: now,
        }));

        set({
          lists: [...state.lists, clonedList],
          listItems: [...state.listItems, ...clonedItems],
        });
        return newId;
      },
    }),
    guestPersistOptions<LocalListsStore>(
      "local-lists-store",
      "lru",
      sanitizeLocalListsState,
    ),
  ),
);
