"use client";
import React, { useState, useRef, useCallback } from "react";
import { useWatchlist } from "@/hooks/usewatchlist";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, FileUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { db } from "@/db";

export default function ExportAndAddWatchlist() {
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  // Use the Dexie-based hook that provides live query data with a loading indicator.
  const { watchlist, loading } = useWatchlist();
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
    } finally {
      setExportLoading(false);
    }
  }, [watchlist]);

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
          const importedData = JSON.parse(content);
          // Expect the imported data to be a JSON array.
          const validatedList = Array.isArray(importedData) ? importedData : [];

          // Map each imported item to ensure it has the correct fields:
          const itemsToImport = validatedList.map((item: any) => ({
            ...item,
            // Force the watchlist items to belong to 'local-guest-user'
            user_id: "local-guest-user",
            // Set/update the timestamp
            updated_at: Date.now(),
          }));

          // Use Dexie's bulkPut to add or update all imported items.
          await db.watchlist.bulkPut(itemsToImport);
          console.log("Imported Watchlist:", itemsToImport);
        } catch (error) {
          console.error("Error importing watchlist:", error);
          alert("Invalid watchlist file format");
        } finally {
          setImportLoading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };

      reader.onerror = () => {
        console.error("Error reading file");
        setImportLoading(false);
      };

      reader.readAsText(file);
    },
    [],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="animate-spin" size={24} />
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
          className={`bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 ${
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
