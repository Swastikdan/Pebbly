import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createMemoryStorage } from "@/lib/utils";

export type LocalList = {
	_id: string;
	name: string;
	color?: string;
	visibility?: string;
	listType?: string;
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
	) => string;

	createListAndAddItem: (args: {
		name: string;
		color?: string;
		visibility?: string;
		listType?: string;
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
		visibility?: string,
		listType?: string,
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
}

const memoryStorage = createMemoryStorage();

export const useLocalListsStore = create<LocalListsStore>()(
	persist(
		(set, get) => ({
			lists: [],
			listItems: [],

			createList: (name, color, visibility, listType) => {
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
						visibility,
						listType,
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
				);

				set((state) => {
					const newItem: LocalListItem = {
						_id: `local_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						listId,
						tmdbId: args.tmdbId,
						mediaType: args.mediaType,
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

			updateList: (listId, name, color, visibility, listType) =>
				set((state) => ({
					lists: state.lists.map((l) =>
						l._id === listId
							? {
									...l,
									name,
									color,
									visibility,
									listType,
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
						// Remove it
						return {
							listItems: state.listItems.filter(
								(_, idx) => idx !== existingIndex,
							),
						};
					}

					// Add it
					const newItem: LocalListItem = {
						_id: `local_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
					};

					return { listItems: [...state.listItems, newItem] };
				}),
		}),
		{
			name: "local-lists-store",
			storage: createJSONStorage(() =>
				typeof window !== "undefined" ? window.localStorage : memoryStorage,
			),
		},
	),
);
