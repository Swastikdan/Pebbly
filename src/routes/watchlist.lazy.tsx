import { Bookmark, ListPlus, Plus } from "lucide-react";
import { lazy, Suspense, useCallback, useId, useMemo, useState } from "react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";

import type {
  WatchlistFilter,
  WatchlistMediaFilter,
  WatchlistReactionFilter,
  WatchlistSort,
} from "@/hooks/use-filtered-watchlist";
import type { WatchlistItem } from "@/hooks/use-watchlist";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { CustomListCard } from "@/components/watchlist/custom-list-card";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { WatchlistFilters } from "@/components/watchlist/watchlist-filters";
import { WatchlistGrid } from "@/components/watchlist/watchlist-grid";
import { useCustomLists } from "@/hooks/use-custom-lists";
import { destructiveToast } from "@/hooks/use-destructive-toast";
import { useFilteredWatchlist } from "@/hooks/use-filtered-watchlist";
import { toast } from "@/hooks/use-toast-store";
import { useToggleWatchlistItem, useWatchlist } from "@/hooks/use-watchlist";
import { useWatchlistImportExport } from "@/hooks/use-watchlist-import-export";
import { useRepository } from "@/lib/repository/use-repository";

const CustomListDialog = lazy(() =>
  import("@/components/custom-list-dialog").then((m) => ({
    default: m.CustomListDialog,
  })),
);

export const Route = createLazyFileRoute("/watchlist")({
  component: WatchlistPage,
});

type PageTab = "watchlist" | "my-lists";

const WATCHLIST_PAGE_SIZE = 30;

function WatchlistPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/watchlist" });

  const activeTab: PageTab =
    search.tab === "collections" || search.tab === "my-lists"
      ? "my-lists"
      : "watchlist";

  const handleTabChange = (v: string) => {
    navigate({
      search: {
        tab: v === "my-lists" ? "collections" : "watchlist",
      },
    });
  };

  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="w-full max-w-screen-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <GoBack title="Back" hideLabelOnMobile />
          <ShareButton title="My Watchlist" hideLabelOnMobile />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-4">
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full"
            >
              <div className="flex items-center justify-center gap-3">
                <TabsList className="w-full max-w-sm sm:w-fit">
                  <TabsTab value="watchlist">
                    <Bookmark size={15} />
                    Watchlist
                  </TabsTab>
                  <TabsTab value="my-lists">
                    <ListPlus size={15} />
                    My Collections
                  </TabsTab>
                </TabsList>
              </div>

              <TabsPanel value="watchlist" className="mt-0">
                <WatchlistTabContent />
              </TabsPanel>

              <TabsPanel value="my-lists" className="mt-0">
                <SilentErrorBoundary>
                  <MyListsTabContent />
                </SilentErrorBoundary>
              </TabsPanel>
            </Tabs>
          </div>
        </div>
      </div>
    </section>
  );
}

function WatchlistTabContent() {
  const importInputId = useId();
  const { watchlist: watchlistData, loading: watchlistLoading } =
    useWatchlist();
  const toggleWatchlist = useToggleWatchlistItem();
  const [activeFilter, setActiveFilter] =
    useState<WatchlistFilter>("watch-later");
  const [reactionFilter, setReactionFilter] =
    useState<WatchlistReactionFilter>("all");
  const [mediaFilter, setMediaFilter] = useState<WatchlistMediaFilter>("all");
  const [sortBy, setSortBy] = useState<WatchlistSort>("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    importLoading,
    importTotal,
    exportLoading,
    error,
    fileInputRef,
    exportWatchlist,
    importWatchlist,
    handleImportClick,
  } = useWatchlistImportExport();

  const { filteredWatchlist, counts } = useFilteredWatchlist(watchlistData, {
    searchQuery,
    activeFilter,
    reactionFilter,
    mediaFilter,
    sortBy,
  });

  const [page, setPage] = useState(1);
  const filterKey = [
    searchQuery,
    activeFilter,
    reactionFilter,
    mediaFilter,
    sortBy,
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

  const activeSecondaryCount = [
    searchQuery.trim().length > 0,
    mediaFilter !== "all",
    reactionFilter !== "all",
    sortBy !== "recent",
  ].filter(Boolean).length;

  const resetSecondaryFilters = useCallback(() => {
    setSearchQuery("");
    setMediaFilter("all");
    setReactionFilter("all");
    setSortBy("recent");
  }, []);

  const handleRemoveFromWatchlist = useCallback(
    (item: WatchlistItem) => {
      toggleWatchlist(
        {
          title: item.title,
          rating: item.rating,
          image: item.image,
          id: item.external_id,
          media_type: item.type,
          release_date: item.release_date ?? "",
          overview: item.overview,
        },
        true,
      ).catch(console.error);
      toast({
        title: "Removed from watchlist",
        description: item.title,
        action: {
          label: "Undo",
          onClick: () => {
            toggleWatchlist(
              {
                title: item.title,
                rating: item.rating,
                image: item.image,
                id: item.external_id,
                media_type: item.type,
                release_date: item.release_date ?? "",
                overview: item.overview,
              },
              false,
            ).catch(console.error);
          },
        },
      });
    },
    [toggleWatchlist],
  );

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
          className={`mb-4 rounded-xl p-3 text-sm ${
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
          className="border-primary/15 bg-primary/5 text-muted-foreground mb-4 rounded-xl border px-3 py-2 text-sm"
          role="status"
        >
          Importing {importTotal} title{importTotal === 1 ? "" : "s"} in one
          batch…
        </div>
      )}

      {watchlistData.length > 0 && (
        <WatchlistFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          reactionFilter={reactionFilter}
          setReactionFilter={setReactionFilter}
          mediaFilter={mediaFilter}
          setMediaFilter={setMediaFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filtersOpen={filtersOpen}
          setFiltersOpen={setFiltersOpen}
          activeSecondaryCount={activeSecondaryCount}
          resetSecondaryFilters={resetSecondaryFilters}
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
          searchQuery.trim().length > 0 ||
          mediaFilter !== "all" ||
          reactionFilter !== "all"
        }
        onRemoveFromWatchlist={handleRemoveFromWatchlist}
      />

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

function MyListsTabContent() {
  const { lists: customLists, loading } = useCustomLists();
  const { deleteList: deleteCustomList, cloneList } = useRepository();
  const [showCreateList, setShowCreateList] = useState(false);
  const [editingList, setEditingList] = useState<{
    id: string;
    name: string;
    color?: string;
    description?: string;
    visibility?: "public" | "private";
    sortType?: "unordered" | "ordered";
  } | null>(null);

  const sortedLists = useMemo(
    () => [...customLists].sort((a, b) => a.sortOrder - b.sortOrder),
    [customLists],
  );

  if (loading) {
    return <DefaultLoader />;
  }

  const deleteListWithUndo = (list: {
    _id: string;
    name: string;
    color?: string | null;
    description?: string | null;
    visibility?: string | null;
    sortType?: "unordered" | "ordered";
  }) => {
    destructiveToast({
      title: "Collection deleted",
      description: list.name,
      onConfirm: () => {
        deleteCustomList(list._id);
      },
    });
  };

  const duplicateList = (list: { _id: string; name: string }) => {
    cloneList(list._id)
      .then(() =>
        toast({
          title: "Collection duplicated",
          description: `"${list.name} (copy)" was added to your collections.`,
        }),
      )
      .catch(console.error);
  };

  return (
    <div className="space-y-6 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            My Collections
          </h2>
          <p className="text-muted-foreground animate-fade-in mt-0.5 text-sm">
            {customLists.length} collection
            {customLists.length !== 1 ? "s" : ""} created
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCreateList(true)}
          className="gap-1.5 text-xs"
        >
          <Plus size={14} />
          New Collection
        </Button>
      </div>

      {sortedLists.length === 0 ? (
        <div className="animate-fade-in-up flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-6 py-16 text-center">
          <div className="relative flex size-20 items-center justify-center">
            <div className="border-border/30 bg-muted/40 absolute size-14 rotate-[-6deg] rounded-xl border shadow-sm" />
            <div className="border-border/40 bg-muted/70 absolute size-14 rotate-[6deg] rounded-xl border shadow-md" />
            <div className="border-border/80 bg-background shadow-primary/5 absolute flex size-14 items-center justify-center rounded-xl border shadow-lg">
              <ListPlus className="text-primary size-6" />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-lg font-bold tracking-tight">
              Create your first collection
            </h3>
            <p className="text-muted-foreground/80 max-w-sm text-xs leading-relaxed">
              Organize movies and TV shows into custom lists, like "Sci-Fi
              Favorites" or "Shows to Binge with Friends".
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="hover:bg-secondary/80 gap-2 px-5 text-xs font-semibold"
            onClick={() => setShowCreateList(true)}
          >
            <Plus size={14} />
            Create Your First Collection
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {sortedLists.map((list) => (
            <CustomListCard
              key={list._id}
              list={list}
              onEdit={() =>
                setEditingList({
                  id: list._id,
                  name: list.name,
                  color: list.color,
                  description: list.description,
                  visibility:
                    (list.visibility as "public" | "private") ?? undefined,
                  sortType: list.sortType,
                })
              }
              onDuplicate={() => duplicateList(list)}
              onDelete={() => {
                deleteListWithUndo(list);
              }}
            />
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        <CustomListDialog
          open={showCreateList}
          onOpenChange={setShowCreateList}
        />
      </Suspense>
      {editingList && (
        <Suspense fallback={null}>
          <CustomListDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) setEditingList(null);
            }}
            listId={editingList.id}
            initialName={editingList.name}
            initialColor={editingList.color}
            initialDescription={editingList.description}
            initialVisibility={editingList.visibility}
            initialSortType={editingList.sortType}
          />
        </Suspense>
      )}
    </div>
  );
}
