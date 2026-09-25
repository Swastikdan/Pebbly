import { SignInButton, useUser } from "@clerk/react";
import { usePostHog } from "@posthog/react";
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
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import type { ProgressStatus } from "@/domain/watchlist";
import type { CollectionPagePayload } from "@/server/fns/list-collections";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { CustomListMediaCard } from "@/components/watchlist/custom-list-media-card";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { useCustomLists } from "@/hooks/use-custom-lists";
import { destructiveToast } from "@/hooks/use-destructive-toast";
import { toast } from "@/lib/notifications";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
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
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
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
    search: search.trim().length >= 2 ? search.trim() : undefined,
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
  });
  const { lists: availableLists } = useCustomLists();
  const localCollectionPage = useMemo<CollectionPagePayload | null>(() => {
    const localList = localLists.find((entry) => entry._id === listId);
    if (!localList) return null;
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filteredItems = localItems
      .filter((item) => item.listId === listId)
      .filter((item) => mediaFilter === "all" || item.mediaType === mediaFilter)
      .filter(
        (item) =>
          normalizedSearch.length < 2 ||
          [item.title, item.overview].some((value) =>
            value?.toLocaleLowerCase().includes(normalizedSearch),
          ),
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
      nextCursor: null,
      hasNextPage: page * 100 < filteredItems.length,
    };
  }, [listId, localItems, localLists, mediaFilter, page, search]);
  const currentCollectionPage = isLocalCollection
    ? localCollectionPage
    : pageQuery.data?.pages[page - 1];
  const totalPages = Math.max(
    1,
    Math.ceil((currentCollectionPage?.totalCount ?? 0) / 100),
  );

  const collectionFilterKey = `${search}|${mediaFilter}`;
  useEffect(() => {
    void collectionFilterKey;
    setPage(1);
    setSelectedKeys(new Set());
  }, [collectionFilterKey]);

  const {
    deleteList: deleteCustomList,
    reorderListItem: reorderItems,
    cloneList,
    bulkUpdateListItems: runBulkListItems,
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
    try {
      const pending = sessionStorage.getItem("pebbly:pending_clone");
      if (pending === listId) {
        sessionStorage.removeItem("pebbly:pending_clone");
        void handleClone();
      }
    } catch {
      // Storage unavailable or blocked
    }
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
  const items = payload.items;
  const isPebblyPicks = list.listType === "pebbly-picks";
  const isOrdered = list.sortType === "ordered";
  const isPublic = list.visibility === "public";
  // Private lists only ever resolve for their owner (visitors get a 404 from
  // the loader), so role === "owner" covers them; pebbly-picks are system
  // lists that must never expose Edit/Delete.
  const canManage = payload.role === "owner" && !isPebblyPicks;

  const indexed = items.map((item, index) => ({ item, index }));
  const filtered =
    mediaFilter === "all"
      ? indexed
      : indexed.filter(({ item }) => item.mediaType === mediaFilter);

  const handleMove = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const order = [...items];
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

  const handleDelete = () => {
    destructiveToast({
      title: "Collection deleted",
      description: list.name,
      onConfirm: () => {
        void deleteCustomList(listId);
      },
    });
    void router.navigate({ to: "/watchlist", search: { tab: "collections" } });
  };

  const selectedItems = items.filter((item) =>
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
      current.size === items.length
        ? new Set()
        : new Set(items.map((item) => `${item.mediaType}:${item.tmdbId}`)),
    );
  };
  const goToCollectionPage = async (nextPage: number) => {
    const target = Math.min(Math.max(nextPage, 1), totalPages);
    if (isLocalCollection) {
      setPage(target);
      return;
    }
    let loadedPages = pageQuery.data?.pages.length ?? 0;
    while (loadedPages < target && pageQuery.hasNextPage) {
      const result = await pageQuery.fetchNextPage();
      loadedPages = result.data?.pages.length ?? loadedPages + 1;
    }
    setPage(Math.min(target, Math.max(loadedPages, 1)));
  };

  const runBulk = async (action: "remove" | "move" | "status") => {
    if (selectedItems.length === 0) return;
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

      setSelectedKeys(new Set());
      await refreshPage();
    } catch (error) {
      logError("bulk collection action", error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Nav Row: Back (left) and Share (right) */}
      <div className="flex items-center justify-between gap-3">
        <GoBack title="Back" />
        <ShareButton title={list.name} />
      </div>

      {/* Title & Actions Row: Title + Visibility + Badges (left) | Edit + Delete (right) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {list.color && (
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: list.color }}
            />
          )}
          <h1 className="text-h1 truncate text-balance">{list.name}</h1>
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
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
              className="border-border text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-lg border px-2.5 text-xs font-medium"
              aria-label={`Edit ${list.name}`}
            >
              <Pencil aria-hidden="true" size={13} />
              <span className="hidden sm:inline">Edit</span>
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
              <span className="hidden sm:inline">
                {isCloning ? "Duplicating..." : "Duplicate"}
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDelete}
              className="border-border text-muted-foreground hover:text-destructive-foreground h-8 gap-1.5 rounded-lg border px-2.5 text-xs font-medium"
              aria-label={`Delete ${list.name}`}
            >
              <Trash2 aria-hidden="true" size={13} />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        ) : (
          isPublic && (
            <div className="flex shrink-0 items-center gap-1">
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
      <div className="text-muted-foreground/75 flex flex-wrap items-center gap-2 text-xs">
        <span>
          {items.length} {items.length === 1 ? "title" : "titles"}
        </span>
        {list.description && (
          <>
            <span>•</span>
            <span className="max-w-md truncate">{list.description}</span>
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

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search this collection"
          aria-label="Search this collection"
          className="h-9 min-w-52 flex-1 sm:max-w-sm"
        />
        {canManage && items.length > 0 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAll}
              aria-pressed={selectedKeys.size === items.length}
            >
              {selectedKeys.size === items.length
                ? "Clear selection"
                : "Select page"}
            </Button>
            {selectedKeys.size > 0 && (
              <span className="text-muted-foreground text-xs">
                {selectedKeys.size} selected
              </span>
            )}
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="scrollbar-hidden flex justify-center gap-1.5 overflow-x-auto sm:justify-start">
          <div className="bg-secondary/50 border-border/40 dark:bg-secondary/30 dark:border-border/20 flex gap-0.5 rounded-lg border p-0.5">
            {(["all", "movie", "tv"] as const).map((filter) => {
              const isActive = mediaFilter === filter;
              const count = items.filter(
                (item) => filter === "all" || item.mediaType === filter,
              ).length;
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
        </div>
      )}

      {canManage && selectedItems.length > 0 && (
        <div className="border-border bg-secondary/30 flex flex-wrap items-center gap-2 rounded-lg border p-2">
          <span className="text-xs font-medium">Bulk actions</span>
          <select
            aria-label="Choose destination collection"
            className="border-border bg-background h-8 rounded-md border px-2 text-xs"
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
            variant="outline"
            disabled={!targetListId}
            onClick={() => void runBulk("move")}
          >
            Move
          </Button>
          <select
            aria-label="Choose watchlist status"
            className="border-border bg-background h-8 rounded-md border px-2 text-xs"
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
            variant="outline"
            disabled={!bulkStatus}
            onClick={() => void runBulk("status")}
          >
            Apply
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => void runBulk("remove")}
          >
            Remove
          </Button>
        </div>
      )}

      {canManage && isOrdered && items.length > 1 && (
        <p className="text-muted-foreground/60 flex items-center gap-1.5 text-xs">
          <ArrowUpDown size={12} className="shrink-0" />
          Ranked list. Use the arrow buttons on each title to rearrange.
        </p>
      )}

      <SilentErrorBoundary>
        {items.length === 0 ? (
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
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-xs">
              No {mediaFilter === "movie" ? "movies" : "TV shows"} in this list.
            </p>
          </div>
        ) : (
          <div className="stagger-grid grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                    ? (dir) => handleMove(index, dir)
                    : undefined
                }
                canMoveUp={page === 1 && index > 0}
                canMoveDown={page === 1 && index < items.length - 1}
                selected={selectedKeys.has(`${item.mediaType}:${item.tmdbId}`)}
                onSelect={() =>
                  toggleSelected(`${item.mediaType}:${item.tmdbId}`)
                }
                showSelect={canManage}
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
            void goToCollectionPage(nextPage);
            window.scrollTo({ top: 0, behavior: "smooth" });
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
