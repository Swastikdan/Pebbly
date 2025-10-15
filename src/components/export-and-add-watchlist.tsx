import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import {
	useWatchlist,
	useWatchlistStore,
	type WatchlistItem,
} from "@/store/usewatchlist";

type ImportError = {
	message: string;
	invalidItems?: number;
};

export const ExportAndAddWatchlist = () => {
	const [importLoading, setImportLoading] = useState(false);
	const [exportLoading, setExportLoading] = useState(false);
	const [error, setError] = useState<ImportError | null>(null);
	const { watchlist, loading } = useWatchlist();
	const setWatchlist = useWatchlistStore((state) => state.setWatchlist);
	const fileInputRef = useRef<HTMLInputElement>(null);

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

			// Cleanup
			setTimeout(() => {
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
			}, 100);
		} catch (err) {
			setError({
				message: "Failed to export watchlist. Please try again.",
			});
			console.error("Export error:", err);
		} finally {
			setExportLoading(false);
		}
	}, [watchlist]);

	const isValidWatchlistItem = useCallback(
		(item: unknown): item is Omit<WatchlistItem, "updated_at"> => {
			if (typeof item !== "object" || item === null) return false;

			const obj = item as Record<string, unknown>;
			const hasRequiredFields =
				typeof obj.title === "string" &&
				typeof obj.rating === "number" &&
				typeof obj.image === "string" &&
				typeof obj.external_id === "string" &&
				(obj.type === "tv" || obj.type === "movie") &&
				typeof obj.release_date === "string";

			// Additional validation
			const isValidRating =
				(obj.rating as number) >= 0 && (obj.rating as number) <= 10;
			const isValidTitle = (obj.title as string).trim().length > 0;

			return hasRequiredFields && isValidRating && isValidTitle;
		},
		[],
	);

	const importWatchlist = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			// Validate file type
			if (!file.name.endsWith(".json")) {
				setError({ message: "Please select a valid JSON file." });
				return;
			}

			// Validate file size (10MB max)
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

					if (importedData.length === 0) {
						throw new Error("Watchlist is empty.");
					}

					let invalidItemCount = 0;
					const validatedList: WatchlistItem[] = [];

					for (const item of importedData) {
						if (isValidWatchlistItem(item)) {
							validatedList.push({
								title: item.title,
								type: item.type,
								external_id: item.external_id,
								image: item.image,
								rating: item.rating,
								release_date: item.release_date,
								updated_at: Date.now(),
							});
						} else {
							invalidItemCount++;
						}
					}

					if (validatedList.length === 0) {
						throw new Error("No valid items found in the watchlist file.");
					}

					// Update store with validated items
					setWatchlist(validatedList);

					// Show warning if some items were invalid
					if (invalidItemCount > 0) {
						setError({
							message: `Successfully imported ${validatedList.length} items. ${invalidItemCount} invalid items were skipped.`,
							invalidItems: invalidItemCount,
						});
					}
				} catch (err) {
					const errorMessage =
						err instanceof Error ? err.message : "Unknown error occurred";
					setError({
						message: `Import failed: ${errorMessage}`,
					});
					console.error("Import error:", err);
				} finally {
					setImportLoading(false);
					// Clear file input
					if (fileInputRef.current) {
						fileInputRef.current.value = "";
					}
				}
			};

			reader.onerror = () => {
				setError({ message: "Error reading file. Please try again." });
				setImportLoading(false);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			};

			reader.readAsText(file);
		},
		[isValidWatchlistItem, setWatchlist],
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

	if (loading) {
		return (
			<div className="flex items-center justify-center py-10">
				<Spinner color="current" />
				<span className="sr-only">Loading watchlist...</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2 pt-5">
			{error && (
				<div
					className={`rounded-md p-3 text-sm ${
						error.invalidItems
							? "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
							: "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
					}`}
					role="alert"
				>
					{error.message}
				</div>
			)}
			<div className="flex justify-end">
				<div className="flex gap-4">
					{(watchlist?.length ?? 0) > 0 && (
						<Button
							className="gap-2 rounded-[calc(var(--radius-md)+3px)]"
							disabled={exportLoading || importLoading}
							variant="secondary"
							onClick={exportWatchlist}
							aria-label="Export watchlist to JSON file"
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
						className="gap-2 rounded-[calc(var(--radius-md)+3px)]"
						disabled={importLoading || exportLoading}
						variant="secondary"
						onClick={handleImportClick}
						onKeyDown={handleKeyDown}
						aria-label="Import watchlist from JSON file"
					>
						{/** biome-ignore lint: not needed */}
						<input
							ref={fileInputRef}
							accept=".json,application/json"
							className="hidden"
							disabled={importLoading || exportLoading}
							id="watchlist-import"
							type="file"
							onChange={importWatchlist}
						/>
						{importLoading ? <Spinner color="current" /> : <Upload size={20} />}
						Import
					</Button>
				</div>
			</div>
		</div>
	);
};
