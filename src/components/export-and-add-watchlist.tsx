"use client";
import React, { useState, useRef, useCallback } from "react";
import { useWatchlist } from "@/hooks/usewatchlist";
import { useWatchlistStore } from "@/store/usewatchliststore";
import type { WatchlistItem } from "@/store/usewatchliststore";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, FileUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { LOCAL_GUEST_USER_ID } from "@/constants";

export default function ExportAndAddWatchlist() {
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  // Use the Zustand-based hook that provides live query data.
  const { watchlist, loading } = useWatchlist();
  const setWatchlist = useWatchlistStore((state) => state.setWatchlist); // Get the setWatchlist action
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportWatchlist = useCallback(async () => {
    try {
      setExportLoading(true);
      // Export the watchlist as a plain JSON array.
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
    } catch (error) {
      console.error("Error exporting watchlist:", error);
      alert("Failed to export watchlist."); // User-friendly error
    } finally {
      setExportLoading(false);
    }
  }, [watchlist]);

  // Type guard to check if an object is a valid WatchlistItem (for import)
  function isValidImportedWatchlistItem(
    item: unknown,
  ): item is Omit<WatchlistItem, "watchlist_id" | "user_id" | "updated_at"> &
    Partial<Pick<WatchlistItem, "watchlist_id">> {
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
                console.warn("Skipping invalid item during import:", item);
                return null;
              }
              return {
                watchlist_id:
                  "watchlist_id" in item &&
                  typeof item.watchlist_id === "string"
                    ? (item.watchlist_id ?? crypto.randomUUID())
                    : crypto.randomUUID(),
                user_id: LOCAL_GUEST_USER_ID,
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
        console.error("Error reading file");
        alert("Error reading file.");
        setImportLoading(false);
      };

      reader.readAsText(file);
    },
    [setWatchlist], // Depend on setWatchlist from Zustand
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        {/* Adjusted loader for better visibility when loading */}
        <Loader2 className="text-primary animate-spin" size={24} />
        <span className="sr-only">Loading watchlist...</span>
      </div>
    );
  }

  return (
    <div className="flex justify-end pt-5">
      <div className="flex gap-4">
        {(watchlist?.length ?? 0) > 0 && (
          <Button
            variant="secondary"
            disabled={exportLoading}
            onClick={exportWatchlist}
            className="gap-2"
          >
            {exportLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <FileDown size={20} />
            )}
            Export
          </Button>
        )}
        <Label
          htmlFor="watchlist-import"
          role="button"
          tabIndex={0}
          aria-label="Import watchlist"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 ${
            importLoading ? "cursor-not-allowed opacity-50" : ""
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={importWatchlist}
            accept=".json"
            className="hidden"
            id="watchlist-import"
            disabled={importLoading}
          />
          {importLoading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <FileUp size={20} />
          )}
          Import
        </Label>
      </div>
    </div>
  );
}
