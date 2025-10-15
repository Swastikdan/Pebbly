"use client";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { useWatchlist } from "@/store/usewatchlist";
import { useWatchlistStore, type WatchlistItem } from "@/store/usewatchlist";

import { Upload, Download } from "@/components/ui/icons";

export const ExportAndAddWatchlist = () => {
	const [importLoading, setImportLoading] = useState(false);
	const [exportLoading, setExportLoading] = useState(false);
	const { watchlist, loading } = useWatchlist();
	const setWatchlist = useWatchlistStore((state) => state.setWatchlist);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const exportWatchlist = useCallback(async () => {
		try {
			setExportLoading(true);
			const json = JSON.stringify(watchlist ?? [], null, 2);
			const blob = new Blob([json], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");

			link.href = url;
			link.download = `watchlist-${new Date().toISOString()}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch {
			alert("Failed to export watchlist.");
		} finally {
			setExportLoading(false);
		}
	}, [watchlist]);

	// Type guard to check if an object is a valid WatchlistItem (for import)
	function isValidImportedWatchlistItem(
		item: unknown,
	): item is Omit<WatchlistItem, "updated_at"> & Partial<WatchlistItem> {
		if (typeof item !== "object" || item === null) return false;
		const obj = item as Record<string, unknown>;

		return (
			typeof obj.title === "string" &&
			typeof obj.rating === "number" &&
			typeof obj.image === "string" &&
			typeof obj.external_id === "string" &&
			(obj.type === "tv" || obj.type === "movie") &&
			typeof obj.release_date === "string"
		);
	}

	const importWatchlist = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setImportLoading(true);
			const file = event.target.files?.[0];

			if (!file) {
				setImportLoading(false);

				return;
			}

			const reader = new FileReader();

			reader.onload = async (e) => {
				try {
					const content = e.target?.result as string;
					const importedData = JSON.parse(content) as unknown; // Parse as unknown first

					// Validate if importedData is an array and its items resemble WatchlistItem
					if (!Array.isArray(importedData)) {
						throw new Error("Invalid file format: Expected a JSON array.");
					}

					const validatedList: WatchlistItem[] = importedData
						.map((item) => {
							if (!isValidImportedWatchlistItem(item)) {
								return null;
							}

							return {
								title: item.title,
								type: item.type,
								external_id: item.external_id,
								image: item.image,
								rating: item.rating,
								release_date: item.release_date,
								updated_at: Date.now(),
							};
						})
						.filter((item): item is WatchlistItem => Boolean(item)); // Filter out any nulls from invalid items

					// Update the Zustand store with the new watchlist
					setWatchlist(validatedList);
				} catch (error) {
					alert(`Invalid watchlist file format: ${(error as Error).message}`);
				} finally {
					setImportLoading(false);
					// Clear the file input to allow selecting the same file again
					if (fileInputRef.current) {
						fileInputRef.current.value = "";
					}
				}
			};

			reader.onerror = () => {
				alert("Error reading file.");
				setImportLoading(false);
			};

			reader.readAsText(file);
		},
		[setWatchlist],
	);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-10">
				<Spinner color="current" />
				<span className="sr-only">Loading watchlist...</span>
			</div>
		);
	}

	return (
		<div className="flex justify-end pt-5">
			<div className="flex gap-4">
				{(watchlist?.length ?? 0) > 0 && (
					<Button
						className="gap-2 rounded-[calc(var(--radius-md)+3px)]"
						disabled={exportLoading}
						variant="secondary"
						onClick={exportWatchlist}
					>
						{exportLoading ? (
							<Spinner color="current" />
						) : (
							<Download size={20} />
						)}
						Export
					</Button>
				)}
				<Button
					aria-label="Import watchlist"
					className={`${importLoading ? "cursor-not-allowed" : ""} rounded-[calc(var(--radius-md)+3px)]`}
					tabIndex={0}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							fileInputRef.current?.click();
						}
					}}
					variant="secondary"
					onClick={() => fileInputRef.current?.click()}
				>
					<input
						ref={fileInputRef}
						accept=".json"
						className="hidden"
						disabled={importLoading}
						id="watchlist-import"
						type="file"
						onChange={importWatchlist}
					/>
					{importLoading ? <Spinner /> : <Upload size={20} />}
					Import
				</Button>
			</div>
		</div>
	);
};
