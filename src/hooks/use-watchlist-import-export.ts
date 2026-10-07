import type React from "react";
import { useUser } from "@clerk/react";
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { ProgressStatus, ReactionStatus } from "@/domain/watchlist";
import type { EpisodeProgressRow } from "@/lib/server-types";
import { useWatchlist, useWatchlistStore } from "@/hooks/use-watchlist";
import { broadcastMutation } from "@/lib/cross-tab-sync";
import { queryKeys } from "@/lib/query/keys";
import { yieldToMain } from "@/lib/safe-idle";
import {
  parseWatchlistImport,
  planImportBatches,
} from "@/lib/watchlist-import";
import { importWatchlist as importWatchlistFn } from "@/server/fns/import-export";
import { getAllEpisodeProgress, getWatchlist } from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import { useLocalProgressStore } from "@/stores/local-progress-store";
import { mapWatchlistRowToItem } from "@/stores/watchlist-store";

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
  const { isSignedIn, user } = useUser();
  const { watchlist, loading } = useWatchlist({ enabled: !isSignedIn });

  const importWatchlistLocal = useWatchlistStore(
    (state) => state.importWatchlistLocal,
  );
  const markEpisodeWatchedLocal = useLocalProgressStore(
    (state) => state.markEpisodeWatched,
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const exportWatchlist = useCallback(async () => {
    if (!watchlist || watchlist.length === 0) return;

    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;

    try {
      setExportLoading(true);
      setError(null);

      const remoteWatchlist = isSignedIn
        ? (await unwrap(getWatchlist({ data: {} }))).map(mapWatchlistRowToItem)
        : watchlist;
      if (remoteWatchlist.length === 0) return;
      const remoteEpisodes = isSignedIn
        ? await unwrap(getAllEpisodeProgress())
        : [];
      const localWatchedEpisodes =
        useLocalProgressStore.getState().watchedEpisodes;

      // Group watched episodes once (O(E)) instead of filtering the full
      // episode list for every title (O(T×E)) — with a few thousand episodes
      // the old loop blocked the main thread for hundreds of ms on phones.
      const watchedByTitle = new Map<string, Record<string, boolean>>();
      if (isSignedIn && remoteEpisodes) {
        for (const ep of remoteEpisodes as EpisodeProgressRow[]) {
          if (!ep.isWatched) continue;
          const key = String(ep.tmdbId);
          const bucket = watchedByTitle.get(key);
          if (bucket) {
            bucket[`${ep.season}:${ep.episode}`] = true;
          } else {
            watchedByTitle.set(key, { [`${ep.season}:${ep.episode}`]: true });
          }
        }
      }
      const watchedPrefixes: Array<{ prefix: string; suffix: string }> = [];
      if (!isSignedIn) {
        for (const [key, val] of Object.entries(localWatchedEpisodes)) {
          if (val) {
            const separator = key.indexOf(":");
            if (separator !== -1) {
              watchedPrefixes.push({
                prefix: key.slice(0, separator + 1),
                suffix: key.slice(separator + 1),
              });
            }
          }
        }
      }

      const enhancedWatchlist = remoteWatchlist.map((item) => {
        const itemWatched: Record<string, boolean> = {};

        if (item.type === "tv") {
          if (isSignedIn && remoteEpisodes) {
            const bucket = watchedByTitle.get(String(item.external_id));
            if (bucket) Object.assign(itemWatched, bucket);
          } else {
            const prefix = `${item.external_id}:`;
            for (const entry of watchedPrefixes) {
              if (entry.prefix === prefix) {
                itemWatched[entry.suffix] = true;
              }
            }
          }
        }

        return {
          ...item,
          ...(Object.keys(itemWatched).length > 0
            ? { watchedEpisodes: itemWatched }
            : {}),
        };
      });

      // Serialize off the interaction path — stringify of a large watchlist
      // is a multi-hundred-ms main-thread block on low-end phones.
      await yieldToMain();
      const json = JSON.stringify(enhancedWatchlist, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      url = URL.createObjectURL(blob);

      link = document.createElement("a");
      const timestamp = new Date().toISOString().split("T")[0];

      link.href = url;
      link.download = `watchlist-${timestamp}.json`;

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (link && document.body.contains(link)) {
          document.body.removeChild(link);
        }
        if (url) {
          URL.revokeObjectURL(url);
        }
      }, 100);
    } catch (err) {
      if (link && document.body.contains(link)) {
        document.body.removeChild(link);
      }
      if (url) {
        URL.revokeObjectURL(url);
      }
      setError({ message: "Failed to export watchlist. Please try again." });
      console.error("Export error:", err);
    } finally {
      setExportLoading(false);
    }
  }, [watchlist, isSignedIn]);

  const importWatchlist = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith(".json")) {
        setError({ message: "Please select a valid JSON (.json) file." });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        setError({ message: "File size exceeds 10MB limit." });
        if (fileInputRef.current) fileInputRef.current.value = "";
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
                broadcastMutation("watchlist");
                try {
                  await queryClient.invalidateQueries({
                    queryKey: queryKeys.watchlist.list(undefined, user?.id),
                  });
                  await queryClient.invalidateQueries({
                    queryKey: queryKeys.watchlist.allEpisodes(user?.id),
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

            broadcastMutation("watchlist");
            await queryClient.invalidateQueries({
              queryKey: queryKeys.watchlist.list(undefined, user?.id),
            });
            await queryClient.invalidateQueries({
              queryKey: queryKeys.watchlist.allEpisodes(user?.id),
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
    [
      importWatchlistLocal,
      isSignedIn,
      markEpisodeWatchedLocal,
      queryClient,
      user?.id,
    ],
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
