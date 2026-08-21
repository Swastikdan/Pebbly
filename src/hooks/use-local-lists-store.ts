import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createLRUStorage, createMemoryStorage } from "@/lib/utils";

export type LocalList = {
	_id: string;
	name: string;
	color?: string;
	description?: string;
	visibility?: string;
	listType?: string;
	sortType?: string;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
};

export type LocalListItem = {
	_id: string;
	listId: string;
	tmdbId: number;
	mediaType: "movie" | "tv";
	addedAt: number;
	position: number;
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
		description?: string,
		visibility?: string,
		listType?: string,
		sortType?: string,
	) => string;

	createListAndAddItem: (args: {
		name: string;
		color?: string;
		description?: string;
		visibility?: string;
		listType?: string;
		sortType?: string;
		tmdbId: number;
		mediaType: "movie" | "tv";
		title?: string;
		image?: string;
		backdrop?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
	}) => void;

	updateList: (
		listId: string,
		name: string,
		color?: string,
		description?: string,
		visibility?: string,
		listType?: string,
		sortType?: string,
	) => void;

	deleteList: (listId: string) => void;

	toggleListItem: (args: {
		listId: string;
		tmdbId: number;
		mediaType: "movie" | "tv";
		title?: string;
		image?: string;
		backdrop?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
	}) => void;

	reorderListItem: (args: {
		listId: string;
		orderedItems: Array<{ tmdbId: number; mediaType: "movie" | "tv" }>;
	}) => void;
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
				description,
				visibility,
				listType,
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
						sortType: sortType ?? "unordered",
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
					args.description,
					args.visibility,
					args.listType,
					args.sortType,
				);

				set((state) => {
					const newItem: LocalListItem = {
						_id: `local_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						listId,
						tmdbId: args.tmdbId,
						mediaType: args.mediaType,
						addedAt: Date.now(),
						position: 0,
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
				description,
				visibility,
				listType,
				sortType,
			) =>
				set((state) => ({
					lists: state.lists.map((l) =>
						l._id === listId
							? {
									...l,
									name,
									color,
									description,
									visibility,
									listType,
									sortType: sortType ?? l.sortType,
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
			toggleListItem: (args) =>
				set((state) => {
					const existingIndex = state.listItems.findIndex(
						(i) => i.listId === args.listId && i.tmdbId === args.tmdbId,
					);

					if (existingIndex !== -1) {
						return {
							listItems: state.listItems.filter(
								(_, idx) => idx !== existingIndex,
							),
						};
					}

					const listItems = state.listItems.filter(
						(i) => i.listId === args.listId,
					);
					const maxPosition =
						listItems.length > 0
							? Math.max(...listItems.map((i) => i.position ?? 0))
							: 0;

					const newItem: LocalListItem = {
						_id: `local_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						listId: args.listId,
						tmdbId: args.tmdbId,
						mediaType: args.mediaType,
						addedAt: Date.now(),
						position: maxPosition + 1,
						title: args.title,
						image: args.image,
						backdrop: args.backdrop,
						rating: args.rating,
						release_date: args.release_date,
						overview: args.overview,
					};

					return { listItems: [...state.listItems, newItem] };
				}),

			reorderListItem: (args) =>
				set((state) => {
					const otherItems = state.listItems.filter(
						(i) => i.listId !== args.listId,
					);
					const listItems = state.listItems.filter(
						(i) => i.listId === args.listId,
					);
					const byKey = new Map(
						listItems.map((i) => [`${i.tmdbId}_${i.mediaType}`, i]),
					);
					const seen = new Set<string>();
					const reordered: LocalListItem[] = [];
					for (const item of args.orderedItems) {
						const key = `${item.tmdbId}_${item.mediaType}`;
						const row = byKey.get(key);
						if (row && !seen.has(key)) {
							reordered.push({ ...row, position: reordered.length });
							seen.add(key);
						}
					}
					for (const row of listItems) {
						const key = `${row.tmdbId}_${row.mediaType}`;
						if (!seen.has(key)) {
							reordered.push({ ...row, position: reordered.length });
							seen.add(key);
						}
					}
					return { listItems: [...otherItems, ...reordered] };
				}),
		}),
		{
			name: "local-lists-store",
			storage: createJSONStorage(() =>
				typeof window !== "undefined" ? lruStorage : memoryStorage,
			),
		},
	),
);
