import { useMutation } from "convex/react";

import type React from "react";

import { useCallback, useRef, useState } from "react";

import { useWatchlist, type WatchlistItem } from "@/hooks/usewatchlist";
import type { ProgressStatus, ReactionStatus } from "@/types";

import { api } from "../../convex/_generated/api";

type ImportError = {
	message: string;
	invalidItems?: number;
};

type ImportItem = Pick<WatchlistItem, "title" | "external_id" | "type"> &
	Partial<Omit<WatchlistItem, "title" | "external_id" | "type">> & {
		status?: string;
	};

function mapLegacyImportedStatus(
	status?: string,
	progress?: number,
): {
	progressStatus: ProgressStatus | null;
	reaction: ReactionStatus | null;
} {
	if (status === "plan-to-watch") {
		return { progressStatus: "want-to-watch", reaction: null };
	}
	if (status === "watching")
		return { progressStatus: "watching", reaction: null };
	if (status === "completed")
		return { progressStatus: "finished", reaction: null };
	if (status === "liked")
		return { progressStatus: "finished", reaction: "liked" };
	if (status === "dropped") {
		const derivedProgress: ProgressStatus =
			progress === undefined || progress <= 0
				? "want-to-watch"
				: progress >= 100
					? "finished"
					: "watching";
		return { progressStatus: derivedProgress, reaction: "not-for-me" };
	}

	return { progressStatus: null, reaction: null };
}

export const useWatchlistImportExport = () => {
	const [importLoading, setImportLoading] = useState(false);
	const [exportLoading, setExportLoading] = useState(false);
	const [error, setError] = useState<ImportError | null>(null);

	const { watchlist, loading } = useWatchlist();

	const setWatchlistMembership = useMutation(
		api.watchlist.setWatchlistMembership,
	);
	const setProgressStatus = useMutation(api.watchlist.setProgressStatus);
	const setReaction = useMutation(api.watchlist.setReaction);

	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const isValidWatchlistItem = useCallback(
		(item: unknown): item is ImportItem => {
			if (typeof item !== "object" || item === null) return false;

			const obj = item as Record<string, unknown>;

			return (
				typeof obj.title === "string" &&
				typeof obj.external_id === "string" &&
				(obj.type === "tv" || obj.type === "movie")
			);
		},
		[],
	);

	const exportWatchlist = useCallback(async () => {
		if (!watchlist || watchlist.length === 0) return;

		try {
			setExportLoading(true);
			setError(null);

			const json = JSON.stringify(watchlist, null, 2);
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
	}, [watchlist]);

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
						if (isValidWatchlistItem(item)) validatedList.push(item);
						else invalidItemCount++;
					}

					if (validatedList.length === 0) {
						throw new Error("No valid items found in the watchlist file.");
					}

					for (const item of validatedList) {
						const legacy = mapLegacyImportedStatus(item.status, item.progress);
						const progressStatus =
							(item.progressStatus as ProgressStatus | undefined) ??
							legacy.progressStatus ??
							"want-to-watch";
						const reaction =
							(item.reaction as ReactionStatus | undefined) ?? legacy.reaction;

						await setWatchlistMembership({
							tmdbId: Number(item.external_id),
							mediaType: item.type,
							inWatchlist: true,
							title: item.title,
							image: item.image,
							rating: item.rating,
							release_date: item.release_date,
							overview: item.overview,
						});

						await setProgressStatus({
							tmdbId: Number(item.external_id),
							mediaType: item.type,
							progressStatus,
							progress: item.progress,
							title: item.title,
							image: item.image,
							rating: item.rating,
							release_date: item.release_date,
							overview: item.overview,
						});

						if (reaction) {
							await setReaction({
								tmdbId: Number(item.external_id),
								mediaType: item.type,
								reaction,
								title: item.title,
								image: item.image,
								rating: item.rating,
								release_date: item.release_date,
								overview: item.overview,
							});
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
			isValidWatchlistItem,
			setProgressStatus,
			setReaction,
			setWatchlistMembership,
		],
	);

	const handleImportClick = useCallback(() => {
		setError(null);
		fileInputRef.current?.click();
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				handleImportClick();
			}
		},
		[handleImportClick],
	);

	return {
		importLoading,
		exportLoading,
		error,
		loading,
		watchlist,
		fileInputRef,
		exportWatchlist,
		importWatchlist,
		handleImportClick,
		handleKeyDown,
		setError,
	};
};
