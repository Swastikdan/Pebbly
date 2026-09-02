import { useCallback, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Download, Upload } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { WatchlistFilters } from "@/components/watchlist/watchlist-filters";
import { WatchlistGrid } from "@/components/watchlist/watchlist-grid";
import { useFilteredWatchlist } from "@/hooks/use-filtered-watchlist";
import { useRemoveFromWatchlistWithUndo } from "@/hooks/use-remove-with-undo";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useWatchlistImportExport } from "@/hooks/use-watchlist-import-export";

const WATCHLIST_PAGE_SIZE = 30;

export function WatchlistTab() {
  const importInputId = useId();
  const { watchlist: watchlistData, loading: watchlistLoading } =
    useWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlistWithUndo();
  const {
    importLoading,
    importTotal,
    importedCount,
    exportLoading,
    error,
    fileInputRef,
    exportWatchlist,
    importWatchlist,
    handleImportClick,
  } = useWatchlistImportExport();

  const filters = useFilteredWatchlist(watchlistData);
  const {
    searchQuery,
    activeFilter,
    reactionFilter,
    mediaFilter,
    filteredWatchlist,
    counts,
  } = filters;

  const [page, setPage] = useState(1);
  const filterKey = [
    searchQuery,
    activeFilter,
    reactionFilter,
    mediaFilter,
    filters.sortBy,
  ].join("|");
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }
  const totalPages = Math.ceil(filteredWatchlist.length / WATCHLIST_PAGE_SIZE);
  const safePage = Math.min(page, Math.max(totalPages, 1));
  const paginatedWatchlist = useMemo(
    () =>
      filteredWatchlist.slice(
        (safePage - 1) * WATCHLIST_PAGE_SIZE,
        safePage * WATCHLIST_PAGE_SIZE,
      ),
    [filteredWatchlist, safePage],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="pt-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">
            Watchlist
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {watchlistData.length} title
            {watchlistData.length !== 1 ? "s" : ""} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(watchlistData?.length ?? 0) > 0 && (
            <Button
              className="gap-1.5 text-xs"
              disabled={exportLoading || importLoading}
              variant="secondary"
              onClick={exportWatchlist}
              aria-label="Export watchlist"
            >
              {exportLoading ? <Spinner /> : <Download size={14} />}
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}
          <Button
            className="gap-1.5 text-xs"
            disabled={importLoading || exportLoading}
            variant="secondary"
            onClick={handleImportClick}
            aria-label="Import watchlist"
          >
            <Input
              ref={fileInputRef}
              accept=".json,application/json"
              className="hidden"
              disabled={importLoading || exportLoading}
              id={importInputId}
              type="file"
              onChange={importWatchlist}
            />
            {importLoading ? <Spinner /> : <Upload size={14} />}
            <span className="hidden sm:inline">Import</span>
          </Button>
        </div>
      </div>

      {error && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            error.invalidItems
              ? "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
          }`}
          role="alert"
        >
          {error.message}
        </div>
      )}
      {importLoading && importTotal !== null && (
        <div
          className="border-primary/15 bg-primary/5 text-muted-foreground mb-4 rounded-lg border px-3 py-2 text-sm"
          role="status"
        >
          {importedCount > 0 && importedCount < importTotal
            ? `Importing ${importedCount} of ${importTotal} titles…`
            : `Importing ${importTotal} title${importTotal === 1 ? "" : "s"}…`}
        </div>
      )}

      {watchlistData.length > 0 && (
        <WatchlistFilters
          filters={filters}
          counts={counts}
          filteredCount={filteredWatchlist.length}
          totalCount={watchlistData.length}
        />
      )}

      <WatchlistGrid
        items={paginatedWatchlist}
        loading={watchlistLoading}
        errorMessage={error ? error.message : null}
        hasActiveFilters={
          activeFilter !== "all" ||
          searchQuery.trim().length >= 2 ||
          mediaFilter !== "all" ||
          reactionFilter !== "all"
        }
        onRemoveFromWatchlist={removeFromWatchlist}
      />

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
