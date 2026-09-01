import {
  ArrowUpDown,
  Globe,
  ListOrdered,
  ListPlus,
  Lock,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { CustomListMediaCard } from "@/components/watchlist/custom-list-media-card";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { destructiveToast } from "@/hooks/use-destructive-toast";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
import { cn, logError } from "@/lib/utils";
import { getCollectionPage } from "@/server/fns/list-collections";
import { unwrap } from "@/server/schema/common";

const CustomListDialog = lazy(() =>
  import("@/components/custom-list-dialog").then((m) => ({
    default: m.CustomListDialog,
  })),
);

export function CollectionPage({ listId }: { listId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mediaFilter, setMediaFilter] = useState<"all" | MediaType>("all");
  const [editing, setEditing] = useState(false);

  const pageQuery = useQuery({
    queryKey: queryKeys.lists.collectionPage(listId),
    queryFn: () => unwrap(getCollectionPage({ data: { listId } })),
  });

  const { deleteList: deleteCustomList, reorderListItem: reorderItems } =
    useRepository();

  const refreshPage = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.lists.collectionPage(listId),
    });

  if (pageQuery.error) {
    return <DefaultNotFoundComponent />;
  }

  if (pageQuery.isPending || !pageQuery.data) {
    return <DefaultLoader />;
  }

  const payload = pageQuery.data;
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
        deleteCustomList(listId);
      },
    });
    router.navigate({ to: "/watchlist", search: { tab: "collections" } });
  };

  return (
    <div className="animate-fade-in space-y-4">
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
          <h1 className="text-foreground truncate text-xl font-bold tracking-tight sm:text-2xl">
            {list.name}
          </h1>
          <span
            className="text-muted-foreground shrink-0"
            title={isPublic ? "Public" : "Private"}
          >
            {isPublic ? <Globe size={14} /> : <Lock size={14} />}
          </span>
          {isPebblyPicks && (
            <span className="bg-foreground text-background inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium">
              <Sparkles size={10} />
              AI Curated
            </span>
          )}
          {isOrdered && (
            <span className="bg-secondary text-secondary-foreground inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium">
              <ListOrdered size={10} />
              Ranked
            </span>
          )}
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
              className="border-border text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-lg border px-2.5 text-xs font-medium"
              aria-label={`Edit ${list.name}`}
            >
              <Pencil size={13} />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDelete}
              className="border-border text-muted-foreground hover:text-destructive h-8 gap-1.5 rounded-lg border px-2.5 text-xs font-medium"
              aria-label={`Delete ${list.name}`}
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
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
        <span className="ml-auto shrink-0 text-[11px]">
          Created{" "}
          {new Date(list.createdAt).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}
        </span>
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

      {canManage && isOrdered && items.length > 1 && (
        <p className="text-muted-foreground/60 flex items-center gap-1.5 text-xs">
          <ArrowUpDown size={12} className="shrink-0" />
          Ranked list. Use the arrow buttons on each title to rearrange.
        </p>
      )}

      <SilentErrorBoundary>
        {items.length === 0 ? (
          <div className="text-muted-foreground animate-fade-in-up flex flex-col items-center justify-center gap-4 py-20 text-center">
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
          <div className="stagger-grid animate-fade-in grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  canManage && isOrdered
                    ? (dir) => handleMove(index, dir)
                    : undefined
                }
                canMoveUp={index > 0}
                canMoveDown={index < items.length - 1}
              />
            ))}
          </div>
        )}
      </SilentErrorBoundary>

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
