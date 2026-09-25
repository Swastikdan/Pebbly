import { useUser } from "@clerk/react";
import { ArrowRightLeft } from "lucide-react";
import { useCallback, useId } from "react";

import { openGuestMigrationModal } from "@/components/auth/guest-migration-dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { WatchlistActivityPanel } from "@/components/watchlist/watchlist-activity-panel";
import { WatchlistFilters } from "@/components/watchlist/watchlist-filters";
import { WatchlistGrid } from "@/components/watchlist/watchlist-grid";
import { useFilteredWatchlist } from "@/hooks/use-filtered-watchlist";
import { useRemoveFromWatchlistWithUndo } from "@/hooks/use-remove-with-undo";
import { useWatchlist, useWatchlistStore } from "@/hooks/use-watchlist";
import { useWatchlistImportExport } from "@/hooks/use-watchlist-import-export";
import { useWatchlistPage } from "@/hooks/use-watchlist-page";
import { useLocalListsStore } from "@/stores/local-lists-store";
import { useLocalProgressStore } from "@/stores/local-progress-store";

export function WatchlistTab() {
  const { isSignedIn } = useUser();
  const localMedia = useWatchlistStore((s) => s.mediaState);
  const localEpisodes = useLocalProgressStore((s) => s.watchedEpisodes);
  const localLists = useLocalListsStore((s) => s.lists);
  const hasGuestData =
    localMedia.length > 0 ||
    Object.values(localEpisodes).some(Boolean) ||
    localLists.length > 0;

  const importInputId = useId();
  const { watchlist: watchlistData } = useWatchlist({ enabled: !isSignedIn });
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
  const { searchQuery, activeFilter, reactionFilter, mediaFilter } = filters;

  const pageState = useWatchlistPage({
    searchQuery,
    activeFilter,
    reactionFilter,
    mediaFilter,
    sortBy: filters.sortBy,
  });
  const watchlistLoading = pageState.loading;
  const currentPage = pageState.currentPage;
  const totalPages = pageState.totalPages;
  const totalCount = pageState.totalCount;
  const displayItems = pageState.items;
  const displayCounts = pageState.counts;
  const libraryCount = displayCounts.all || totalCount;

  const handlePageChange = useCallback(
    (newPage: number) => {
      void pageState.goToPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [pageState],
  );

  return (
    <div className="pt-3">
      {isSignedIn && hasGuestData && (
        <div className="bg-primary/5 border-primary/20 mb-4 flex flex-col gap-3 rounded-lg border p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <ArrowRightLeft
              aria-hidden="true"
              size={16}
              className="text-primary shrink-0"
            />
            <p className="text-foreground text-xs">
              You have{" "}
              <span className="font-semibold">
                {localMedia.length} guest title
                {localMedia.length === 1 ? "" : "s"}
              </span>{" "}
              saved locally in this browser.
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={openGuestMigrationModal}
            className="shrink-0 text-xs font-semibold"
          >
            Review & Merge
          </Button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            Watchlist
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {libraryCount} title{libraryCount !== 1 ? "s" : ""} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(watchlistLoading || libraryCount > 0) && (
            <Button
              className="gap-1.5 text-xs"
              disabled={watchlistLoading || exportLoading || importLoading}
              variant="secondary"
              onClick={exportWatchlist}
              aria-label="Export watchlist"
            >
              {exportLoading ? (
                <Spinner aria-hidden="true" />
              ) : (
                <Download aria-hidden="true" size={14} />
              )}
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}
          <Button
            className="gap-1.5 text-xs"
            disabled={watchlistLoading || importLoading || exportLoading}
            variant="secondary"
            onClick={handleImportClick}
            aria-label="Import watchlist"
          >
            <Input
              ref={fileInputRef}
              accept=".json,application/json"
              className="hidden"
              disabled={watchlistLoading || importLoading || exportLoading}
              id={importInputId}
              type="file"
              onChange={importWatchlist}
            />
            {importLoading ? (
              <Spinner aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" size={14} />
            )}
            <span className="hidden sm:inline">Import</span>
          </Button>
        </div>
      </div>

      {error && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            error.invalidItems
              ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
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

      {isSignedIn && <WatchlistActivityPanel />}

      {(watchlistLoading || totalCount > 0) && (
        <WatchlistFilters
          filters={filters}
          counts={displayCounts}
          filteredCount={totalCount}
          totalCount={libraryCount}
          disabled={watchlistLoading}
        />
      )}

      <WatchlistGrid
        items={displayItems}
        loading={watchlistLoading}
        errorMessage={error ? error.message : null}
        totalWatchlistCount={libraryCount}
        hasActiveFilters={
          activeFilter !== "all" ||
          searchQuery.trim().length >= 2 ||
          mediaFilter !== "all" ||
          reactionFilter !== "all"
        }
        onRemoveFromWatchlist={removeFromWatchlist}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
