import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import type React from "react";

import { useCallback, useRef, useState } from "react";
import { useLocalProgressStore } from "@/hooks/use-local-progress-store";
import {
	useWatchlist,
	useWatchlistStore,
	type WatchlistItem,
} from "@/hooks/use-watchlist";
import { normalizeProgressStatus } from "@/lib/utils";
import type { ReactionStatus } from "@/types";

import { api } from "../../convex/_generated/api";

function isValidWatchlistItem(item: unknown): item is ImportItem {
	if (typeof item !== "object" || item === null) return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.title === "string" &&
		typeof obj.external_id === "string" &&
		(obj.type === "tv" || obj.type === "movie")
	);
}

type ImportError = {
	message: string;
	invalidItems?: number;
};

type ImportItem = Pick<WatchlistItem, "title" | "external_id" | "type"> &
	Partial<Omit<WatchlistItem, "title" | "external_id" | "type">> & {
		status?: string;
		watchedEpisodes?: Record<string, boolean>;
	};

export const useWatchlistImportExport = () => {
	const [importLoading, setImportLoading] = useState(false);
	const [importTotal, setImportTotal] = useState<number | null>(null);
	const [exportLoading, setExportLoading] = useState(false);
	const [error, setError] = useState<ImportError | null>(null);

	const { watchlist, loading } = useWatchlist();

	const importWatchlistBatch = useMutation(api.watchlist.importWatchlist);
	const importWatchlistLocal = useWatchlistStore(
		(state) => state.importWatchlistLocal,
	);
	const markEpisodeWatchedLocal = useLocalProgressStore(
		(state) => state.markEpisodeWatched,
	);

	const { isSignedIn } = useUser();
	const allEpisodeProgress = useQuery(
		api.watchlist.getAllEpisodeProgress,
		isSignedIn ? {} : "skip",
	);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const exportWatchlist = useCallback(async () => {
		if (!watchlist || watchlist.length === 0) return;

		try {
			setExportLoading(true);
			setError(null);

			const localWatchedEpisodes =
				useLocalProgressStore.getState().watchedEpisodes;

			const enhancedWatchlist = watchlist.map((item) => {
				const itemWatched: Record<string, boolean> = {};

				if (item.type === "tv") {
					if (isSignedIn && allEpisodeProgress) {
						allEpisodeProgress
							.filter(
								(ep: {
									tmdbId: number;
									isWatched: boolean;
									season: number;
									episode: number;
								}) =>
									String(ep.tmdbId) === String(item.external_id) &&
									ep.isWatched,
							)
							.forEach((ep: { season: number; episode: number }) => {
								itemWatched[`${ep.season}:${ep.episode}`] = true;
							});
					} else {
						const prefix = `${item.external_id}:`;
						Object.entries(localWatchedEpisodes).forEach(([key, val]) => {
							if (key.startsWith(prefix) && val) {
								const suffix = key.slice(prefix.length);
								itemWatched[suffix] = true;
							}
						});
					}
				}

				return {
					...item,
					...(Object.keys(itemWatched).length > 0
						? { watchedEpisodes: itemWatched }
						: {}),
				};
			});

			const json = JSON.stringify(enhancedWatchlist, null, 2);
			const blob = new Blob([json], { type: "application/json" });
			const url = URL.createObjectURL(blob);

			const link = document.createElement("a");
			const timestamp = new Date().toISOString().split("T")[0];

			link.href = url;
			link.download = `watchlist-${timestamp}.json`;

			document.body.appendChild(link);
			link.click();

			setTimeout(() => {
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
			}, 100);
		} catch (err) {
			setError({ message: "Failed to export watchlist. Please try again." });
			console.error("Export error:", err);
		} finally {
			setExportLoading(false);
		}
	}, [watchlist, isSignedIn, allEpisodeProgress]);

	const importWatchlist = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			if (!file.name.endsWith(".json")) {
				setError({ message: "Please select a valid JSON file." });
				return;
			}

			const MAX_FILE_SIZE = 10 * 1024 * 1024;
			if (file.size > MAX_FILE_SIZE) {
				setError({ message: "File size exceeds 10MB limit." });
				return;
			}

			setImportLoading(true);
			setImportTotal(null);
			setError(null);

			const reader = new FileReader();

			reader.onload = async (e) => {
				try {
					const content = e.target?.result as string;
					if (!content || content.trim().length === 0) {
						throw new Error("File is empty.");
					}

					const importedData = JSON.parse(content) as unknown;
					if (!Array.isArray(importedData)) {
						throw new Error("Invalid file format: Expected a JSON array.");
					}

					let invalidItemCount = 0;
					const validatedList: ImportItem[] = [];

					for (const item of importedData) {
						if (
							isValidWatchlistItem(item) &&
							Number.isFinite(Number(item.external_id))
						) {
							validatedList.push(item);
						} else {
							invalidItemCount++;
						}
					}

					if (validatedList.length === 0) {
						throw new Error("No valid items found in the watchlist file.");
					}

					const watchedEpisodes: Array<{
						tmdbId: number;
						season: number;
						episode: number;
					}> = [];
					for (const item of validatedList) {
						if (
							item.watchedEpisodes &&
							typeof item.watchedEpisodes === "object"
						) {
							for (const [key, isWatched] of Object.entries(
								item.watchedEpisodes,
							)) {
								if (!isWatched) continue;
								const [seasonStr, episodeStr] = key.split(":");
								const season = Number.parseInt(seasonStr, 10);
								const episode = Number.parseInt(episodeStr, 10);

								if (!Number.isNaN(season) && !Number.isNaN(episode)) {
									watchedEpisodes.push({
										tmdbId: Number(item.external_id),
										season,
										episode,
									});
								}
							}
						}
					}

					setImportTotal(validatedList.length);
					const importItems = validatedList.map((item) => ({
							tmdbId: Number(item.external_id),
							mediaType: item.type,
							title: item.title,
							image: item.image,
							rating: item.rating,
							release_date: item.release_date,
							overview: item.overview,
							progressStatus: normalizeProgressStatus(item.progressStatus as string) ?? "watch-later",
							progress: item.progress,
							reaction: (item.reaction as ReactionStatus | null) ?? null,
						}));

					if (isSignedIn) {
						await importWatchlistBatch({
							items: importItems,
							watchedEpisodes,
						});
					} else {
						importWatchlistLocal(
							importItems.map((item) => ({
								id: String(item.tmdbId),
								type: item.mediaType,
								title: item.title,
								image: item.image,
								rating: item.rating,
								release_date: item.release_date,
								overview: item.overview,
								progressStatus: item.progressStatus,
								progress: item.progress,
								reaction: item.reaction,
							})),
						);
						for (const episode of watchedEpisodes) {
							markEpisodeWatchedLocal(
								episode.tmdbId,
								episode.season,
								episode.episode,
								true,
							);
						}
					}

					if (invalidItemCount > 0) {
						setError({
							message: `Successfully imported ${validatedList.length} items. ${invalidItemCount} invalid items were skipped.`,
							invalidItems: invalidItemCount,
						});
					} else {
						setError(null);
					}
				} catch (err) {
					const errorMessage =
						err instanceof Error ? err.message : "Unknown error occurred";
					setError({ message: `Import failed: ${errorMessage}` });
					console.error("Import error:", err);
				} finally {
					setImportLoading(false);
					if (fileInputRef.current) fileInputRef.current.value = "";
				}
			};

			reader.onerror = () => {
				setError({ message: "Error reading file. Please try again." });
				setImportLoading(false);
				if (fileInputRef.current) fileInputRef.current.value = "";
			};

			reader.readAsText(file);
		},
		[
			importWatchlistBatch,
			importWatchlistLocal,
			isSignedIn,
			markEpisodeWatchedLocal,
		],
	);

	const handleImportClick = useCallback(() => {
		setError(null);
		fileInputRef.current?.click();
	}, []);

	return {
		importLoading,
		importTotal,
		exportLoading,
		error,
		loading,
		watchlist,
		fileInputRef,
		exportWatchlist,
		importWatchlist,
		handleImportClick,
		setError,
	};
};
