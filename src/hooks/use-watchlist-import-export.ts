import type React from "react";
import { useUser } from "@clerk/react";
import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProgressStatus, ReactionStatus } from "@/domain/watchlist";
import type { EpisodeProgressRow } from "@/lib/server-types";
import { useWatchlist, useWatchlistStore } from "@/hooks/use-watchlist";
import { fetchAllEpisodeProgress } from "@/lib/data/watchlist-queries";
import { queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import {
  parseWatchlistImport,
  planImportBatches,
} from "@/lib/watchlist-import";
import { importWatchlist as importWatchlistFn } from "@/server/fns/import-export";
import { unwrap } from "@/server/schema/common";
import { useLocalProgressStore } from "@/stores/local-progress-store";

type ImportError = {
  message: string;
  invalidItems?: number;
};

export const useWatchlistImportExport = () => {
  const [importLoading, setImportLoading] = useState(false);
  const [importTotal, setImportTotal] = useState<number | null>(null);
  const [importedCount, setImportedCount] = useState(0);
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
                (ep: EpisodeProgressRow) =>
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
      setImportedCount(0);
      setError(null);

      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = (e.target?.result as string) ?? "";
          const parsed = parseWatchlistImport(content);
          if (!parsed.ok) {
            throw new Error(parsed.message);
          }

          setImportTotal(parsed.items.length);

          if (isSignedIn) {
            let importedSoFar = 0;
            try {
              for (const batch of planImportBatches(
                parsed.items,
                parsed.watchedEpisodes,
              )) {
                await unwrap(importWatchlistFn({ data: batch }));
                importedSoFar += batch.items.length;
                setImportedCount(importedSoFar);
              }
            } catch (batchErr) {
              // Some batches may have committed before the failure. Finalize
              // the partial import (refresh caches and publish the mutation
              // for cross-tab sync, normally skipped for non-final batches)
              // so the UI reflects what actually landed, then rethrow.
              if (importedSoFar > 0) {
                recordOwnMutation("watchlist");
                try {
                  await queryClient.invalidateQueries({
                    queryKey: queryKeys.watchlist.list(),
                  });
                  await queryClient.invalidateQueries({
                    queryKey: queryKeys.watchlist.allEpisodes(),
                  });
                } catch {
                  // Cache refresh is best-effort here; the original failure
                  // is what the user needs to see.
                }
              }
              const message =
                batchErr instanceof Error ? batchErr.message : String(batchErr);
              throw new Error(
                `${message} (imported ${importedSoFar} of ${parsed.items.length} titles before failing)`,
              );
            }

            recordOwnMutation("watchlist");
            await queryClient.invalidateQueries({
              queryKey: queryKeys.watchlist.list(),
            });
            await queryClient.invalidateQueries({
              queryKey: queryKeys.watchlist.allEpisodes(),
            });
          } else {
            importWatchlistLocal(
              parsed.items.map((item) => ({
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
            for (const episode of parsed.watchedEpisodes) {
              markEpisodeWatchedLocal(
                episode.tmdbId,
                episode.season,
                episode.episode,
                true,
              );
            }
          }

          if (parsed.invalidItemCount > 0) {
            setError({
              message: `Successfully imported ${parsed.items.length} titles. ${parsed.invalidItemCount} invalid items were skipped.`,
              invalidItems: parsed.invalidItemCount,
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
    importedCount,
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
