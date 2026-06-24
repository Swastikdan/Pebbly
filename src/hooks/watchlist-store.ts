import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
	createLRUStorage,
	createMemoryStorage,
	normalizeProgressStatus,
} from "@/lib/utils";
import type { ProgressStatus, ReactionStatus } from "@/types";

export type MediaType = "tv" | "movie";

export type MediaMetadata = {
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

export type WatchlistItem = {
	title: string;
	type: MediaType;
	external_id: string;
	image: string;
	rating: number;
	release_date: string;
	overview?: string;
	updated_at: number;
	created_at: number;
	inWatchlist: boolean;
	progressStatus: ProgressStatus | null;
	reaction: ReactionStatus | null;
	progress?: number;
};

interface WatchlistStore {
	mediaState: WatchlistItem[];
	setWatchlistMembershipLocal: (
		id: string,
		type: MediaType,
		inWatchlist: boolean,
		metadata?: MediaMetadata,
	) => void;
	setProgressStatusLocal: (
		id: string,
		type: MediaType,
		progressStatus: ProgressStatus,
		progress?: number,
		metadata?: MediaMetadata,
	) => void;
	setReactionLocal: (
		id: string,
		type: MediaType,
		reaction: ReactionStatus | null,
		metadata?: MediaMetadata,
	) => void;
	setProgressLocal: (
		id: string,
		type: MediaType,
		progress: number,
		metadata?: MediaMetadata,
	) => void;
}

const memoryStorage = createMemoryStorage();
const lruStorage = createLRUStorage();

function isSameItem(item: WatchlistItem, id: string, type: MediaType) {
	return item.external_id === id && item.type === type;
}

function buildFallbackItem(
	id: string,
	type: MediaType,
	metadata?: MediaMetadata,
): WatchlistItem {
	return {
		title: metadata?.title ?? `Media ${id}`,
		type,
		external_id: String(id),
		image: metadata?.image ?? "",
		rating: metadata?.rating ?? 0,
		release_date: metadata?.release_date ?? "",
		overview: metadata?.overview,
		updated_at: Date.now(),
		created_at: Date.now(),
		inWatchlist: false,
		progressStatus: null,
		reaction: null,
		progress: 0,
	};
}

export function mapConvexItemToWatchlistItem(item: {
	tmdbId: number;
	mediaType: string;
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
	updatedAt: number;
	progress?: number;
	inWatchlist?: boolean;
	progressStatus?: string;
	reaction?: string;
}): WatchlistItem {
	return {
		title: item.title ?? "Unknown Title",
		type: item.mediaType as MediaType,
		external_id: String(item.tmdbId),
		image: item.image ?? "",
		rating: item.rating ?? 0,
		release_date: item.release_date ?? "",
		overview: item.overview,
		updated_at: item.updatedAt,
		created_at: item.updatedAt,
		inWatchlist: item.inWatchlist ?? true,
		progressStatus: normalizeProgressStatus(item.progressStatus),
		reaction: (item.reaction as ReactionStatus | undefined) ?? null,
		progress: item.progress ?? 0,
	};
}

function mergeMediaMetadata(
	item: WatchlistItem,
	metadata?: MediaMetadata,
): WatchlistItem {
	return {
		...item,
		title: metadata?.title ?? item.title,
		image: metadata?.image ?? item.image,
		rating: metadata?.rating ?? item.rating,
		release_date: metadata?.release_date ?? item.release_date,
		overview: metadata?.overview ?? item.overview,
		updated_at: Date.now(),
	};
}

function upsertLocalMediaState(
	items: WatchlistItem[],
	id: string,
	type: MediaType,
	metadata: MediaMetadata | undefined,
	onCreate: (fallback: WatchlistItem) => WatchlistItem | null,
	onUpdate: (current: WatchlistItem) => WatchlistItem,
) {
	const existingIndex = items.findIndex((item) => isSameItem(item, id, type));

	if (existingIndex === -1) {
		const created = onCreate(buildFallbackItem(id, type, metadata));
		return created ? [created, ...items] : items;
	}

	const nextItems = [...items];
	nextItems[existingIndex] = mergeMediaMetadata(
		onUpdate(nextItems[existingIndex]),
		metadata,
	);
	return nextItems;
}

export const useWatchlistStore = create<WatchlistStore>()(
	persist(
		(set) => ({
			mediaState: [],
			setWatchlistMembershipLocal: (id, type, inWatchlist, metadata) =>
				set((state) => {
					return {
						mediaState: upsertLocalMediaState(
							state.mediaState,
							id,
							type,
							metadata,
							(fallback) => {
								if (!inWatchlist) return null;
								return {
									...fallback,
									inWatchlist: true,
									progressStatus: "watch-later",
								};
							},
							(current) => ({
								...current,
								inWatchlist,
								progressStatus:
									current.progressStatus ??
									(inWatchlist ? "watch-later" : null),
							}),
						),
					};
				}),
			setProgressStatusLocal: (id, type, progressStatus, progress, metadata) =>
				set((state) => {
					const nextProgress =
						progress !== undefined
							? progress
							: progressStatus === "done"
								? 100
								: progressStatus === "watch-later"
									? 0
									: undefined;

					return {
						mediaState: upsertLocalMediaState(
							state.mediaState,
							id,
							type,
							metadata,
							(fallback) => ({
								...fallback,
								progressStatus,
								progress: nextProgress ?? 0,
							}),
							(current) => ({
								...current,
								progressStatus,
								progress: nextProgress ?? current.progress,
							}),
						),
					};
				}),
			setReactionLocal: (id, type, reaction, metadata) =>
				set((state) => {
					return {
						mediaState: upsertLocalMediaState(
							state.mediaState,
							id,
							type,
							metadata,
							(fallback) => ({ ...fallback, reaction }),
							(current) => ({ ...current, reaction }),
						),
					};
				}),
			setProgressLocal: (id, type, progress, metadata) =>
				set((state) => {
					return {
						mediaState: upsertLocalMediaState(
							state.mediaState,
							id,
							type,
							metadata,
							(fallback) => ({
								...fallback,
								progress,
								progressStatus:
									fallback.progressStatus ??
									(progress >= 95 ? "done" : progress > 0 ? "watching" : null),
							}),
							(current) => ({
								...current,
								progress,
								progressStatus:
									current.progressStatus ??
									(progress >= 95 ? "done" : progress > 0 ? "watching" : null),
							}),
						),
					};
				}),
		}),
		{
			name: "watchlist-storage",
			storage: createJSONStorage(() =>
				typeof window !== "undefined" ? lruStorage : memoryStorage,
			),
		},
	),
);
