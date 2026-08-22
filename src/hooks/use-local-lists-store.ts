import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MediaType } from "@/lib/media-types";
import { createLRUStorage, createMemoryStorage } from "@/lib/utils";

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

const memoryStorage = createMemoryStorage();
const lruStorage = createLRUStorage();

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
				const id = `local_list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
				set((state) => {
					const nextSortOrder =
						state.lists.length > 0
							? Math.max(...state.lists.map((l) => l.sortOrder)) + 1
							: 0;

					const newList: LocalList = {
						_id: id,
						name,
						color,
						description,
						visibility,
						listType,
						sortType,
						sortOrder: nextSortOrder,
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
					const listItems = state.listItems.filter((i) => i.listId === listId);
					const nextPosition =
						listItems.length > 0
							? Math.max(...listItems.map((i) => i.position ?? 0)) + 1
							: 1;

					const newItem: LocalListItem = {
						_id: `local_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						listId,
						tmdbId: args.tmdbId,
						mediaType: args.mediaType,
						position: nextPosition,
						addedAt: Date.now(),
						title: args.title,
						image: args.image,
						backdrop: args.backdrop,
						rating: args.rating,
						release_date: args.release_date,
						overview: args.overview,
					};

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
							? {
									...l,
									...(name !== undefined && { name }),
									...(color !== undefined && { color }),
									...(visibility !== undefined && { visibility }),
									...(listType !== undefined && { listType }),
									...(description !== undefined && { description }),
									...(sortType !== undefined && { sortType }),
									updatedAt: Date.now(),
								}
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
					const nextPosition =
						siblings.length > 0
							? Math.max(...siblings.map((i) => i.position ?? 0)) + 1
							: 1;

					const newItem: LocalListItem = {
						_id: `local_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						listId: args.listId,
						tmdbId: args.tmdbId,
						mediaType: args.mediaType,
						position: nextPosition,
						addedAt: Date.now(),
						title: args.title,
						image: args.image,
						backdrop: args.backdrop,
						rating: args.rating,
						release_date: args.release_date,
						overview: args.overview,
					};

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

				const newId = `local_list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
				const now = Date.now();
				const nextSortOrder =
					state.lists.length > 0
						? Math.max(...state.lists.map((l) => l.sortOrder)) + 1
						: 0;

				const clonedList: LocalList = {
					...source,
					_id: newId,
					name,
					visibility: "private",
					listType: "custom",
					sortOrder: nextSortOrder,
					createdAt: now,
					updatedAt: now,
				};

				const sourceItems = state.listItems.filter(
					(i) => i.listId === sourceListId,
				);
				const clonedItems = sourceItems.map((item, index) => ({
					...item,
					_id: `local_item_${now}_${Math.random().toString(36).substr(2, 9)}`,
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
		{
			name: "local-lists-store",
			storage: createJSONStorage(() =>
				typeof window !== "undefined" ? lruStorage : memoryStorage,
			),
		},
	),
);
