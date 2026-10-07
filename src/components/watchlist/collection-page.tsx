import { SignInButton, useUser } from "@clerk/react";
import { usePostHog } from "@posthog/react";
import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import type { ProgressStatus } from "@/domain/watchlist";
import type { CollectionPagePayload } from "@/server/fns/list-collections";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  Copy,
  Globe,
  ListOrdered,
  ListPlus,
  Lock,
  Pencil,
  Sparkles,
  Trash2,
} from "@/components/ui/hugeicons";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { CustomListMediaCard } from "@/components/watchlist/custom-list-media-card";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { useCustomLists } from "@/hooks/use-custom-lists";
import { collectionViewMode } from "@/lib/collection-view";
import { destructiveToast, toast } from "@/lib/notifications";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
import { safeIdle } from "@/lib/safe-idle";
import { cn, formatMediaTitle, logError } from "@/lib/utils";
import { getCollectionPage } from "@/server/fns/list-collections";
import { unwrap } from "@/server/schema/common";
import { useLocalListsStore } from "@/stores/local-lists-store";

const CustomListDialog = lazy(() =>
  import("@/components/custom-list-dialog").then((m) => ({
    default: m.CustomListDialog,
  })),
);

export function CollectionPage({ listId }: { listId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const posthog = usePostHog();

  const [mediaFilter, setMediaFilter] = useState<"all" | MediaType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Search keystrokes must not re-render the 100-card grid synchronously:
  // the input keeps its own controlled value for instant feedback while the
  // query + filtering below run on the deferred (render-bgated) value.
  const deferredSearch = useDeferredValue(search);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [targetListId, setTargetListId] = useState("");
  const [bulkStatus, setBulkStatus] = useState<ProgressStatus | "">("");
  const [editing, setEditing] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const localLists = useLocalListsStore((state) => state.lists);
  const localItems = useLocalListsStore((state) => state.listItems);
  const isLocalCollection = listId.startsWith("local_");
  const collectionArgs = {
    listId,
    limit: 100,
    search:
      deferredSearch.trim().length >= 2 ? deferredSearch.trim() : undefined,
    mediaType: mediaFilter === "all" ? undefined : mediaFilter,
  };
  const pageQuery = useInfiniteQuery({
    queryKey: queryKeys.lists.collectionPage(listId, user?.id, collectionArgs),
    queryFn: ({ pageParam }) =>
      unwrap(
        getCollectionPage({
          data: { ...collectionArgs, cursor: pageParam },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !isLocalCollection,
    // Changing the filter/search must not blank the grid back to a loader:
    // keepPreviousData holds the previous grid painted while the next page
    // streams in, so mobile avoids a full 100-card unmount/remount (style,
    // layout and image decode) per keystroke or tab tap.
    placeholderData: keepPreviousData,
  });
  const { lists: availableLists } = useCustomLists();
  const localCollectionPage = useMemo<CollectionPagePayload | null>(() => {
    const localList = localLists.find((entry) => entry._id === listId);
    if (!localList) return null;
    const normalizedSearch = deferredSearch.trim().toLocaleLowerCase();
    const collectionItems = localItems.filter((item) => item.listId === listId);
    const searchedItems = collectionItems.filter(
      (item) =>
        normalizedSearch.length < 2 ||
        [item.title, item.overview].some((value) =>
          value?.toLocaleLowerCase().includes(normalizedSearch),
        ),
    );
    const filteredItems = searchedItems.filter(
      (item) => mediaFilter === "all" || item.mediaType === mediaFilter,
    );
    const pageItems = filteredItems.slice((page - 1) * 100, page * 100);
    return {
      role: "owner",
      list: {
        id: localList._id,
        userId: "local",
        name: localList.name,
        color: localList.color ?? null,
        description: localList.description ?? null,
        visibility:
          localList.visibility === "public" ||
          localList.visibility === "private"
            ? localList.visibility
            : null,
        listType:
          localList.listType === "custom" ||
          localList.listType === "pebbly-picks"
            ? localList.listType
            : null,
        sortType: localList.sortType ?? "unordered",
        sortOrder: localList.sortOrder,
        createdAt: localList.createdAt,
        updatedAt: localList.updatedAt,
      },
      items: pageItems.map((item, index) => ({
        id: item._id,
        userId: "local",
        listId: item.listId,
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        position: item.position ?? index + 1,
        addedAt: item.addedAt,
        title: item.title ?? null,
        image: item.image ?? null,
        backdrop: item.backdrop ?? null,
        rating: item.rating ?? null,
        releaseDate: item.release_date ?? null,
        overview: item.overview ?? null,
        progressStatus: null,
        reaction: null,
        release_date: item.release_date ?? null,
      })),
      totalCount: filteredItems.length,
      // Search-scoped but mediaType-independent, so selecting a media type the
      // list has none of never blanks out the filter tabs.
      mediaTypeCounts: {
        all: searchedItems.length,
        movie: searchedItems.filter((item) => item.mediaType === "movie")
          .length,
        tv: searchedItems.filter((item) => item.mediaType === "tv").length,
      },
      collectionItemCount: collectionItems.length,
      nextCursor: null,
      hasNextPage: page * 100 < filteredItems.length,
    };
  }, [listId, localItems, localLists, mediaFilter, page, deferredSearch]);
  const currentCollectionPage = isLocalCollection
    ? localCollectionPage
    : pageQuery.data?.pages[page - 1];
  const totalPages = Math.max(
    1,
    Math.ceil((currentCollectionPage?.totalCount ?? 0) / 100),
  );

  const items = currentCollectionPage?.items ?? [];
  // Single fused pass instead of filter+two more filters per keystroke; the
  // result shape is identical to the previous `.filter()` chain.
  const visibleItems = useMemo(() => {
    const visible: (typeof items)[number][] = [];
    for (const item of items) {
      if (!hiddenKeys.has(`${item.mediaType}:${item.tmdbId}`)) {
        visible.push(item);
      }
    }
    return visible;
  }, [items, hiddenKeys]);
  // Filter changes reset page/selection state. Keyed on the deferred search
  // so the reset lands in the same render pass as the filtered results (and
  // the input keeps its instant echo).
  const collectionFilterKey = `${deferredSearch}|${mediaFilter}`;
  useEffect(() => {
    void collectionFilterKey;
    setPage(1);
    setSelectedKeys(new Set());
    setHiddenKeys(new Set());
  }, [collectionFilterKey]);

  const {
    deleteListWithUndo: repoDeleteList,
    reorderListItem: reorderItems,
    cloneList,
    bulkUpdateListItems: runBulkListItems,
    toggleListItem,
  } = useRepository();

  const handleClone = useCallback(async () => {
    if (isCloning || !currentCollectionPage?.list) return;
    const currentList = currentCollectionPage.list;
    setIsCloning(true);
    try {
      const newId = await cloneList(listId);
      if (newId) {
        posthog?.capture("collection_cloned", {
          source_collection_id: listId,
          is_public: currentList.visibility === "public",
        });
        toast({
          title: "Collection copied",
          description: `"${currentList.name} (copy)" was added to your collections.`,
          type: "success",
        });
        await router.navigate({
          to: "/c/$id/{-$slug}",
          params: {
            id: newId,
            slug: formatMediaTitle.encode(`${currentList.name} (copy)`),
          },
        });
      }
    } catch (error) {
      logError("clone list", error);
      toast({
        title: "Failed to copy collection",
        description: "Please try again later.",
        type: "error",
      });
    } finally {
      setIsCloning(false);
    }
  }, [
    isCloning,
    currentCollectionPage?.list,
    cloneList,
    listId,
    posthog,
    router,
  ]);

  useEffect(() => {
    if (!user || !currentCollectionPage?.list) return;
    // sessionStorage is a synchronous main-thread storage hit; a pending
    // clone must still be honored before the user can act, but it can wait
    // for the next idle window instead of adding work to hydration/layout.
    const readPendingClone = safeIdle(
      () => {
        try {
          const pending = sessionStorage.getItem("pebbly:pending_clone");
          if (pending === listId) {
            sessionStorage.removeItem("pebbly:pending_clone");
            void handleClone();
          }
        } catch {
          // Storage unavailable or blocked
        }
      },
      // Bound it so a slow-to-idle browser still clones promptly.
      { timeout: 500 },
    );
    return readPendingClone;
  }, [user, currentCollectionPage?.list, listId, handleClone]);

  const refreshPage = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.lists.collectionPagesPrefix(listId, user?.id),
    });

  if (pageQuery.error) {
    return <DefaultNotFoundComponent />;
  }

  if ((!isLocalCollection && pageQuery.isPending) || !currentCollectionPage) {
    return <DefaultLoader />;
  }

  const payload = currentCollectionPage;
  const list = payload.list;
  const { mediaTypeCounts, collectionItemCount } = payload;
  // The list area (mode, no-matches copy) keys off the deferred search so it
  // can never disagree with the grid while a keystroke is still rendering.
  const trimmedSearch = deferredSearch.trim();
  const viewMode = collectionViewMode({
    mediaFilter,
    search: deferredSearch,
    visibleCount: visibleItems.length,
  });
  const resetFilters = () => {
    setSearch("");
    setMediaFilter("all");
  };
  const isPebblyPicks = list.listType === "pebbly-picks";
  const isOrdered = list.sortType === "ordered";
  const isPublic = list.visibility === "public";
  // Private lists only ever resolve for their owner (visitors get a 404 from
  // the loader), so role === "owner" covers them; pebbly-picks are system
  // lists that must never expose Edit/Delete.
  const canManage = payload.role === "owner" && !isPebblyPicks;

  const indexed = visibleItems.map((item, index) => ({ item, index }));
  const filtered =
    mediaFilter === "all"
      ? indexed
      : indexed.filter(({ item }) => item.mediaType === mediaFilter);

  const handleMove = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= visibleItems.length) return;
    const order = [...visibleItems];
    [order[index], order[target]] = [order[target], order[index]];
    reorderItems({
      listId,
      orderedItems: order.map((entry) => ({
        tmdbId: entry.tmdbId,
        mediaType: entry.mediaType,
      })),
    })
      .then(refreshPage)
      .catch((error) => logError("reorder list items", error));
  };

  /** Binds one card's move callbacks at render time instead of a fresh inline arrow per card per render. */
  const handleMoveIndex = (index: number) => (dir: -1 | 1) =>
    handleMove(index, dir);

  const handleDelete = () => {
    const op = repoDeleteList(listId);
    destructiveToast({
      title: "Collection deleted",
      description: list.name,
      onUndo: () => {
        op.undo();
        void router.navigate({
          to: "/c/$id/{-$slug}",
          params: { id: listId, slug: formatMediaTitle.encode(list.name) },
        });
      },
      onConfirm: () => {
        op.commit();
      },
    });
    void router.navigate({ to: "/watchlist", search: { tab: "collections" } });
  };

  const selectedItems = visibleItems.filter((item) =>
    selectedKeys.has(`${item.mediaType}:${item.tmdbId}`),
  );
  const toggleSelected = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const selectAll = () => {
    setSelectedKeys((current) =>
      current.size === visibleItems.length
        ? new Set()
        : new Set(
            visibleItems.map((item) => `${item.mediaType}:${item.tmdbId}`),
          ),
    );
  };
  const goToCollectionPage = async (nextPage: number) => {
    const target = Math.min(Math.max(nextPage, 1), totalPages);
    // Apply the page synchronously. placeholderData: keepPreviousData keeps
    // the previous grid painted during the fetch, so the scroll-to-top and
    // the new content arrive together instead of the old page jumping around
    // after a loader flash.
    setPage(target);
    if (isLocalCollection) return;
    let loadedPages = pageQuery.data?.pages.length ?? 0;
    while (loadedPages < target && pageQuery.hasNextPage) {
      const result = await pageQuery.fetchNextPage();
      loadedPages = result.data?.pages.length ?? loadedPages + 1;
    }
  };

  const runBulk = async (action: "remove" | "move" | "status") => {
    if (selectedItems.length === 0) return;

    if (action === "remove") {
      const removedItems = [...selectedItems];
      const removedKeys = removedItems.map(
        (item) => `${item.mediaType}:${item.tmdbId}`,
      );

      setHiddenKeys((prev) => {
        const next = new Set(prev);
        for (const k of removedKeys) next.add(k);
        return next;
      });
      setSelectedKeys(new Set());

      destructiveToast({
        title: `Removed ${removedItems.length} ${removedItems.length === 1 ? "item" : "items"}`,
        description: `Removed from ${list.name}`,
        onUndo: () => {
          setHiddenKeys((prev) => {
            const next = new Set(prev);
            for (const k of removedKeys) next.delete(k);
            return next;
          });
        },
        onConfirm: async () => {
          try {
            await runBulkListItems({
              listId,
              items: removedItems.map((item) => ({
                tmdbId: item.tmdbId,
                mediaType: item.mediaType,
              })),
              action: "remove",
            });
            await refreshPage();
          } catch (error) {
            logError("bulk remove collection items", error);
          }
        },
      });
      return;
    }

    try {
      await runBulkListItems({
        listId,
        items: selectedItems.map((item) => ({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
        })),
        action,
        targetListId: action === "move" ? targetListId : undefined,
        progressStatus:
          action === "status" ? bulkStatus || undefined : undefined,
      });

      // Keep selection alive so users can apply move AND status to the same
      // batch without having to re-select. Only Remove clears selection.
      if (action === "move") {
        toast({
          title: `Moved ${selectedItems.length} ${selectedItems.length === 1 ? "title" : "titles"}`,
          type: "success",
        });
        setTargetListId("");
      } else if (action === "status") {
        toast({
          title: `Status updated for ${selectedItems.length} ${selectedItems.length === 1 ? "title" : "titles"}`,
          type: "success",
        });
        setBulkStatus("");
      }
      await refreshPage();
    } catch (error) {
      logError("bulk collection action", error);
    }
  };

  /**
   * Single-item removal straight from a card. Hides the card optimistically
   * (same mechanism as bulk remove) instead of routing through the card's
   * destructive toast, so the row disappears instantly and one shared
   * refetch — not per-card server round trips — reconciles the page.
   * Local (guest) collections route through toggleListItem, which is the
   * same mutation the old card-level toast used.
   */
  const runRemoveItem = ({
    tmdbId,
    mediaType,
  }: {
    tmdbId: number;
    mediaType: MediaType;
  }) => {
    const itemKey = `${mediaType}:${tmdbId}`;
    setHiddenKeys((prev) => {
      if (prev.has(itemKey)) return prev;
      const next = new Set(prev);
      next.add(itemKey);
      return next;
    });
    const restore = () =>
      setHiddenKeys((prev) => {
        if (!prev.has(itemKey)) return prev;
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    destructiveToast({
      title: "Removed from collection",
      timeout: 5000,
      onUndo: restore,
      onConfirm: () => {
        const mutation = isLocalCollection
          ? toggleListItem({ listId, tmdbId, mediaType })
          : runBulkListItems({
              listId,
              items: [{ tmdbId, mediaType }],
              action: "remove",
            }).then(() => refreshPage());
        mutation.catch((error) => {
          logError("remove collection item", error);
          // Restore the card if the mutation failed.
          restore();
        });
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Nav Row: Back (left) and Share (right) */}
      <div className="flex items-center justify-between gap-3">
        <GoBack title="Back" />
        <ShareButton title={list.name} />
      </div>

      {/* Title & Actions Row: Title + Visibility + Badges (left) | Edit + Delete (right) */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
          <h1
            className="text-h1 truncate text-balance"
            // Raw list colors are picked as swatches, not text colors (gold
            // lands at 1.8:1 on light). Blending the hue into the page
            // foreground keeps the collection identity readable in both themes
            // (worst case ~4:1), instead of a plain foreground heading.
            style={
              list.color
                ? {
                    color: `color-mix(in oklab, ${list.color} 60%, var(--foreground))`,
                  }
                : undefined
            }
          >
            {list.name}
          </h1>
          <span
            className="text-muted-foreground shrink-0"
            title={isPublic ? "Public" : "Private"}
          >
            {isPublic ? (
              <Globe aria-hidden="true" size={14} />
            ) : (
              <Lock aria-hidden="true" size={14} />
            )}
            <span className="sr-only">
              {isPublic ? "Public collection" : "Private collection"}
            </span>
          </span>
          {isPebblyPicks && (
            <span className="bg-foreground text-background inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium">
              <Sparkles aria-hidden="true" size={10} />
              AI Curated
            </span>
          )}
          {isOrdered && (
            <span className="bg-secondary text-secondary-foreground inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium">
              <ListOrdered aria-hidden="true" size={10} />
              Ranked
            </span>
          )}
        </div>

        {canManage ? (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
              className="border-border text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-lg border px-2.5 text-xs font-medium"
              aria-label={`Edit ${list.name}`}
            >
              <Pencil aria-hidden="true" size={13} />
              <span>Edit</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isCloning}
              onClick={handleClone}
              className="border-border text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-lg border px-2.5 text-xs font-medium"
              aria-label={`Duplicate ${list.name}`}
            >
              <Copy aria-hidden="true" size={13} />
              <span>{isCloning ? "Duplicating..." : "Duplicate"}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDelete}
              className="border-destructive/40 text-destructive-foreground hover:bg-destructive/10 h-8 gap-1.5 rounded-lg border px-2.5 text-xs font-medium"
              aria-label={`Delete ${list.name}`}
            >
              <Trash2 aria-hidden="true" size={13} />
              <span>Delete</span>
            </Button>
          </div>
        ) : (
          isPublic && (
            <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
              {user ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isCloning}
                  onClick={handleClone}
                  className="border-border text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-lg border px-2.5 text-xs font-medium"
                  aria-label={`Save a copy of ${list.name}`}
                >
                  <Copy aria-hidden="true" size={13} />
                  <span>{isCloning ? "Saving..." : "Save a Copy"}</span>
                </Button>
              ) : (
                <SignInButton mode="modal">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      try {
                        sessionStorage.setItem("pebbly:pending_clone", listId);
                      } catch {
                        // ignore
                      }
                    }}
                    className="border-border text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-lg border px-2.5 text-xs font-medium"
                    aria-label={`Save a copy of ${list.name}`}
                  >
                    <Copy aria-hidden="true" size={13} />
                    <span>Save a Copy</span>
                  </Button>
                </SignInButton>
              )}
            </div>
          )
        )}
      </div>

      {/* Meta Row: count • description • created date */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="text-foreground font-medium">
          {collectionItemCount} {collectionItemCount === 1 ? "title" : "titles"}
        </span>
        {list.description && (
          <>
            <span aria-hidden="true">•</span>
            <span className="max-w-xl truncate">{list.description}</span>
          </>
        )}
        <span className="ms-auto shrink-0 text-[11px]">
          Created{" "}
          {new Date(list.createdAt).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}
        </span>
      </div>

      {/* Single toolbar: filters + search + selection */}
      <div className="border-border/60 bg-card flex flex-wrap items-center gap-2 rounded-xl border p-2">
        {collectionItemCount > 0 && (
          <div className="bg-secondary/50 border-border/40 flex gap-0.5 rounded-lg border p-0.5">
            {(["all", "movie", "tv"] as const).map((filter) => {
              const isActive = mediaFilter === filter;
              const count = mediaTypeCounts[filter];
              const label =
                filter === "all"
                  ? "All"
                  : filter === "movie"
                    ? "Movies"
                    : "TV Shows";

              return (
                <Button
                  key={filter}
                  type="button"
                  variant="ghost"
                  onClick={() => setMediaFilter(filter)}
                  aria-pressed={isActive}
                  className={cn(
                    "h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-[color,background-color,box-shadow]",
                    isActive
                      ? "bg-foreground text-background hover:bg-foreground"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                  )}
                >
                  {label}
                  <span className="text-[10px] tabular-nums opacity-60">
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search this collection"
          aria-label="Search this collection"
          className="h-9 min-w-44 flex-1"
        />
        {canManage && visibleItems.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAll}
            aria-pressed={selectedKeys.size === visibleItems.length}
            className="h-9 shrink-0"
          >
            {selectedKeys.size > 0 && selectedKeys.size === visibleItems.length
              ? "Clear selection"
              : selectedKeys.size > 0
                ? `${selectedKeys.size} selected`
                : "Select"}
          </Button>
        )}
      </div>

      {canManage && isOrdered && visibleItems.length > 1 && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ArrowUpDown size={12} className="shrink-0" />
          Ranked list. Use Up / Down on each title to rearrange.
        </p>
      )}

      {canManage && selectedItems.length > 0 && (
        <div className="border-border/60 bg-background/95 sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 backdrop-blur-md">
          {/* Count */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[11px] font-bold tabular-nums",
                !list.color && "bg-foreground text-background",
              )}
              style={
                list.color
                  ? { backgroundColor: list.color, color: "#ffffff" }
                  : undefined
              }
            >
              {selectedItems.length}
            </span>
            <span className="text-foreground text-xs font-semibold">
              selected
            </span>
          </div>

          <div className="bg-border/60 mx-1 h-5 w-px shrink-0" />

          {/* Move */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Choose destination collection"
              className="border-border bg-secondary/60 text-foreground h-7 rounded-md border px-2 text-[11px] font-medium focus:outline-none"
              value={targetListId}
              onChange={(event) => setTargetListId(event.target.value)}
            >
              <option value="">Move to…</option>
              {availableLists
                .filter((candidate) => candidate._id !== listId)
                .map((candidate) => (
                  <option key={candidate._id} value={candidate._id}>
                    {candidate.name}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant={targetListId ? "default" : "outline"}
              disabled={!targetListId}
              onClick={() => void runBulk("move")}
              className="h-7 rounded-md px-2.5 text-[11px] font-medium"
            >
              Move
            </Button>
          </div>

          <div className="bg-border/60 mx-1 h-5 w-px shrink-0" />

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Choose watchlist status"
              className="border-border bg-secondary/60 text-foreground h-7 rounded-md border px-2 text-[11px] font-medium focus:outline-none"
              value={bulkStatus}
              onChange={(event) =>
                setBulkStatus(event.target.value as ProgressStatus | "")
              }
            >
              <option value="">Set status…</option>
              <option value="watch-later">Watch later</option>
              <option value="watching">Watching</option>
              <option value="done">Watched</option>
              <option value="dropped">Dropped</option>
            </select>
            <Button
              type="button"
              size="sm"
              variant={bulkStatus ? "default" : "outline"}
              disabled={!bulkStatus}
              onClick={() => void runBulk("status")}
              className="h-7 rounded-md px-2.5 text-[11px] font-medium"
            >
              Apply
            </Button>
          </div>

          <div className="bg-border/60 mx-1 h-5 w-px shrink-0" />

          {/* Remove */}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => void runBulk("remove")}
            className="h-7 rounded-md px-2.5 text-[11px] font-medium"
          >
            Remove
          </Button>

          {/* Select-all / close toggle */}
          {(() => {
            const allSelected = selectedKeys.size === visibleItems.length;
            return (
              <button
                type="button"
                onClick={selectAll}
                aria-label={allSelected ? "Clear selection" : "Select all"}
                title={allSelected ? "Clear selection" : "Select all"}
                className="text-muted-foreground hover:text-foreground ms-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
              >
                {allSelected ? (
                  /* ✕ close */
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 1l10 10M11 1L1 11"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  /* select-all: two overlapping squares */
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="1"
                      y="4"
                      width="9"
                      height="9"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M4 3V2.5A1.5 1.5 0 0 1 5.5 1h6A1.5 1.5 0 0 1 13 2.5v6A1.5 1.5 0 0 1 11.5 10H11"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            );
          })()}
        </div>
      )}

      <SilentErrorBoundary>
        {viewMode === "empty" ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="bg-secondary/60 flex size-14 items-center justify-center rounded-lg">
              <ListPlus className="text-muted-foreground/80 size-6" />
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">
                This collection is empty
              </p>
              <p className="text-muted-foreground/60 mt-1 max-w-xs text-xs">
                Add movies and TV shows from their detail pages to build your
                collection.
              </p>
            </div>
          </div>
        ) : viewMode === "no-matches" ? (
          // The collection has titles, but the current search/media-type filter
          // matches none. The filter tabs above stay mounted so this state is
          // always escapable.
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-xs">
              {mediaFilter !== "all" && trimmedSearch.length >= 2
                ? `No ${mediaFilter === "movie" ? "movies" : "TV shows"} match "${trimmedSearch}".`
                : mediaFilter !== "all"
                  ? `No ${mediaFilter === "movie" ? "movies" : "TV shows"} in this collection.`
                  : `No titles match "${trimmedSearch}".`}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
            >
              Show all titles
            </Button>
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 gap-2.5 min-[440px]:grid-cols-3 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
            {filtered.map(({ item, index }) => (
              <CustomListMediaCard
                key={`${item.tmdbId}-${item.mediaType}`}
                item={{
                  tmdbId: item.tmdbId,
                  mediaType: item.mediaType,
                  title: item.title ?? undefined,
                  image: item.image ?? undefined,
                  backdrop: item.backdrop ?? undefined,
                  rating: item.rating ?? undefined,
                  release_date: item.release_date ?? undefined,
                  overview: item.overview ?? undefined,
                  progressStatus:
                    item.progressStatus === null
                      ? undefined
                      : item.progressStatus,
                  reaction: item.reaction === null ? undefined : item.reaction,
                }}
                listId={listId}
                priority={index < 7}
                readOnly={!canManage}
                rank={isOrdered ? index + 1 : undefined}
                onMove={
                  canManage && isOrdered && page === 1
                    ? handleMoveIndex(index)
                    : undefined
                }
                canMoveUp={page === 1 && index > 0}
                canMoveDown={page === 1 && index < visibleItems.length - 1}
                selected={selectedKeys.has(`${item.mediaType}:${item.tmdbId}`)}
                onSelect={() =>
                  toggleSelected(`${item.mediaType}:${item.tmdbId}`)
                }
                showSelect={canManage}
                listColor={list.color ?? undefined}
                onRemove={
                  canManage
                    ? () =>
                        void runRemoveItem({
                          tmdbId: item.tmdbId,
                          mediaType: item.mediaType,
                        })
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </SilentErrorBoundary>

      {totalPages > 1 && (
        <Pagination
          currentPage={Math.min(page, totalPages)}
          totalPages={totalPages}
          onPageChange={(nextPage) => {
            // Instant scroll: the new grid replaces the old one at the top,
            // so smooth scrolling animates away from content being swapped.
            // `behavior: "smooth"` here also forced a main-thread scroll
            // animation to fight the 100-card remount underneath it.
            void goToCollectionPage(nextPage);
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {editing && (
        <Suspense fallback={null}>
          <CustomListDialog
            open
            onOpenChange={(open) => {
              if (!open) {
                setEditing(false);
                refreshPage();
              }
            }}
            listId={list.id}
            initialName={list.name}
            initialColor={list.color ?? undefined}
            initialDescription={list.description ?? undefined}
            initialVisibility={
              (list.visibility as "public" | "private") ?? "private"
            }
            initialSortType={list.sortType}
          />
        </Suspense>
      )}
    </div>
  );
}
