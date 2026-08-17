import { useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import * as v from "valibot";
import { useLocalProgressStore } from "@/hooks/use-local-progress-store";
import { useWatchlist, useWatchlistStore } from "@/hooks/use-watchlist";
import { fetchAllEpisodeProgress } from "@/hooks/watchlist-queries";
import { queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import type { AllEpisodeProgressRow } from "@/lib/server-types";
import { normalizeProgressStatus } from "@/lib/utils";
import { importWatchlist as importWatchlistFn } from "@/server/fns/import-export";
import { unwrap } from "@/server/schema/common";
import {
	importWatchlistArgsSchema,
	type ImportItem as ServerImportItem,
	type WatchedEpisode,
} from "@/server/schema/import";
import type { ProgressStatus, ReactionStatus } from "@/types";

type ImportError = {
	message: string;
	invalidItems?: number;
};

type RawImportItem = {
	title?: unknown;
	name?: unknown;
	external_id?: unknown;
	id?: unknown;
	tmdbId?: unknown;
	type?: unknown;
	media_type?: unknown;
	mediaType?: unknown;
	image?: unknown;
	poster_path?: unknown;
	rating?: unknown;
	vote_average?: unknown;
	release_date?: unknown;
	releaseDate?: unknown;
	first_air_date?: unknown;
	overview?: unknown;
	inWatchlist?: unknown;
	progressStatus?: unknown;
	status?: unknown;
	progress?: unknown;
	reaction?: unknown;
	watchedEpisodes?: unknown;
};

export const useWatchlistImportExport = () => {
	const [importLoading, setImportLoading] = useState(false);
	const [importTotal, setImportTotal] = useState<number | null>(null);
	const [exportLoading, setExportLoading] = useState(false);
	const [error, setError] = useState<ImportError | null>(null);

	const queryClient = useQueryClient();
	const { watchlist, loading } = useWatchlist();

	const importWatchlistLocal = useWatchlistStore(
		(state) => state.importWatchlistLocal,
	);
	const markEpisodeWatchedLocal = useLocalProgressStore(
		(state) => state.markEpisodeWatched,
	);

	const { isSignedIn } = useUser();
	const allEpisodeProgress = useQuery({
		queryKey: queryKeys.watchlist.allEpisodes(),
		queryFn: () => fetchAllEpisodeProgress(queryClient),
		enabled: !!isSignedIn,
	});
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
					if (isSignedIn && allEpisodeProgress.data) {
						allEpisodeProgress.data
							.filter(
								(ep: AllEpisodeProgressRow) =>
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
	}, [watchlist, isSignedIn, allEpisodeProgress.data]);

	const importWatchlist = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			if (!file.name.endsWith(".json")) {
				setError({ message: "Please select a valid JSON (.json) file." });
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
						throw new Error("The selected file is empty.");
					}

					let importedData: unknown;
					try {
						importedData = JSON.parse(content);
					} catch {
						throw new Error(
							"Invalid JSON format: Unable to parse file content. Please check the file for syntax errors.",
						);
					}

					if (!Array.isArray(importedData)) {
						throw new Error(
							"Invalid file structure: Expected a JSON array of items at the root level.",
						);
					}

					if (importedData.length === 0) {
						throw new Error(
							"The uploaded JSON array is empty. No items found to import.",
						);
					}

					let invalidItemCount = 0;
					const validationErrors: string[] = [];
					const validItems: ServerImportItem[] = [];
					const watchedEpisodes: WatchedEpisode[] = [];

					for (let i = 0; i < importedData.length; i++) {
						const raw = importedData[i] as RawImportItem;
						if (typeof raw !== "object" || raw === null) {
							invalidItemCount++;
							validationErrors.push(`Item #${i + 1}: Not a valid JSON object.`);
							continue;
						}

						const rawTitle = raw.title ?? raw.name;
						if (typeof rawTitle !== "string" || rawTitle.trim() === "") {
							invalidItemCount++;
							validationErrors.push(`Item #${i + 1}: Missing title name.`);
							continue;
						}
						const title = rawTitle.trim();

						const rawId = raw.external_id ?? raw.tmdbId ?? raw.id;
						const tmdbId = Number(rawId);
						if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
							invalidItemCount++;
							validationErrors.push(
								`Item #${i + 1} ("${title}"): Invalid TMDB ID (${String(rawId)}).`,
							);
							continue;
						}

						const rawType = raw.type ?? raw.mediaType ?? raw.media_type;
						const mediaType =
							rawType === "tv" || rawType === "movie" ? rawType : null;
						if (!mediaType) {
							invalidItemCount++;
							validationErrors.push(
								`Item #${i + 1} ("${title}"): Invalid media type (${String(rawType)}). Must be "tv" or "movie".`,
							);
							continue;
						}

						const rawImage = raw.image ?? raw.poster_path;
						const image =
							typeof rawImage === "string" && rawImage.trim() !== ""
								? rawImage.trim()
								: null;

						const rawRating = raw.rating ?? raw.vote_average;
						const rating =
							typeof rawRating === "number" && !Number.isNaN(rawRating)
								? Math.min(Math.max(rawRating, 0), 10)
								: null;

						const rawDate =
							raw.release_date ?? raw.releaseDate ?? raw.first_air_date;
						const release_date =
							typeof rawDate === "string" && rawDate.trim() !== ""
								? rawDate.trim()
								: null;

						const overview =
							typeof raw.overview === "string" && raw.overview.trim() !== ""
								? raw.overview.trim()
								: null;

						const inWatchlist =
							raw.inWatchlist !== undefined && raw.inWatchlist !== null
								? Boolean(raw.inWatchlist)
								: true;

						const rawStatus = raw.progressStatus ?? raw.status;
						const progressStatus =
							normalizeProgressStatus(
								typeof rawStatus === "string" ? rawStatus : undefined,
							) ?? "watch-later";

						const rawProgress = raw.progress;
						const progress =
							typeof rawProgress === "number" && !Number.isNaN(rawProgress)
								? Math.min(Math.max(rawProgress, 0), 100)
								: null;

						const rawReaction = raw.reaction;
						const reaction =
							typeof rawReaction === "string" && rawReaction.trim() !== ""
								? (rawReaction.trim() as ReactionStatus)
								: null;

						validItems.push({
							tmdbId,
							mediaType,
							title,
							image,
							rating,
							release_date,
							overview,
							inWatchlist,
							progressStatus,
							progress,
							reaction,
						});

						if (
							mediaType === "tv" &&
							raw.watchedEpisodes &&
							typeof raw.watchedEpisodes === "object"
						) {
							for (const [key, isWatched] of Object.entries(
								raw.watchedEpisodes as Record<string, unknown>,
							)) {
								if (!isWatched) continue;
								const [seasonStr, episodeStr] = key.split(":");
								const season = Number.parseInt(seasonStr, 10);
								const episode = Number.parseInt(episodeStr, 10);

								if (!Number.isNaN(season) && !Number.isNaN(episode)) {
									watchedEpisodes.push({
										tmdbId,
										season,
										episode,
									});
								}
							}
						}
					}

					if (validItems.length === 0) {
						const sampleErrors = validationErrors.slice(0, 3).join(" ");
						throw new Error(
							`No valid items found in the watchlist file. ${sampleErrors}`,
						);
					}

					// Pre-validate full payload on the client with Valibot schema
					const payload = {
						items: validItems,
						watchedEpisodes,
					};

					const validationResult = v.safeParse(
						importWatchlistArgsSchema,
						payload,
					);
					if (!validationResult.success) {
						const firstIssue = validationResult.issues[0];
						const issuePath =
							firstIssue.path?.map((p) => p.key).join(".") ?? "root";
						throw new Error(
							`Validation error in ${issuePath}: ${firstIssue.message}`,
						);
					}

					setImportTotal(validItems.length);

					if (isSignedIn) {
						await unwrap(
							importWatchlistFn({
								data: validationResult.output,
							}),
						);
						recordOwnMutation("watchlist");
						await queryClient.invalidateQueries({
							queryKey: queryKeys.watchlist.list(),
						});
						await queryClient.invalidateQueries({
							queryKey: queryKeys.watchlist.allEpisodes(),
						});
						// Imported shows also write episode progress — refresh any
						// per-show episode caches.
						await queryClient.invalidateQueries({
							queryKey: ["watchlist", "episodes"],
						});
					} else {
						importWatchlistLocal(
							validItems.map((item) => ({
								id: String(item.tmdbId),
								type: item.mediaType,
								title: item.title,
								image: item.image ?? "",
								rating: item.rating ?? 0,
								release_date: item.release_date ?? "",
								overview: item.overview ?? undefined,
								inWatchlist: item.inWatchlist ?? true,
								progressStatus: (item.progressStatus as ProgressStatus) ?? null,
								progress: item.progress ?? 0,
								reaction: item.reaction as ReactionStatus | null,
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
							message: `Successfully imported ${validItems.length} titles. ${invalidItemCount} invalid items were skipped.`,
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
		[importWatchlistLocal, isSignedIn, markEpisodeWatchedLocal, queryClient],
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
