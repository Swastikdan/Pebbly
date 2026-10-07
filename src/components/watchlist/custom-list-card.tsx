import { Link } from "@tanstack/react-router";

import {
  Copy,
  Globe,
  ListOrdered,
  Lock,
  Pencil,
  Sparkles,
  Trash2,
} from "@/components/ui/hugeicons";
import { ListCollage } from "@/components/watchlist/list-collage";
import { cn, formatMediaTitle } from "@/lib/utils";

const PEBBLY_PICKS_TYPE = "pebbly-picks";

export function CustomListCard({
  list,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  list: {
    _id: string;
    name: string;
    color?: string;
    description?: string;
    visibility?: string;
    listType?: string;
    sortType?: string;
    createdAt: number;
    updatedAt: number;
    previews?: string[];
    itemCount?: number;
  };
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const previews = list.previews ?? [];
  const itemCount = list.itemCount ?? 0;
  const isPebblyPicks = list.listType === PEBBLY_PICKS_TYPE;
  const isPublic = list.visibility === "public";
  const isOrdered = list.sortType === "ordered";

  const href = `/c/${list._id}/${formatMediaTitle.encode(list.name)}`;

  return (
    <div
      className={cn(
        "group/card border-border bg-card hover:border-foreground/20 relative flex flex-col rounded-xl border p-2.5 shadow-sm transition-[border-color,box-shadow] duration-250 hover:shadow-md",
      )}
    >
      <div className="relative">
        <Link
          to={href}
          className="relative block aspect-16/10 w-full overflow-hidden rounded-lg text-start"
          aria-label={`Open ${list.name}`}
        >
          <ListCollage previews={previews} color={list.color} />
        </Link>

        {isPebblyPicks && (
          <span className="bg-foreground text-background absolute start-2 top-2 z-10 flex size-6 items-center justify-center rounded-md">
            <Sparkles aria-hidden="true" size={12} />
            <span className="sr-only">AI curated</span>
          </span>
        )}

        <div className="absolute end-2 top-2 z-10 flex items-center gap-1">
          {isPublic && (
            <span
              className="flex size-7 items-center justify-center rounded-md bg-black/40 text-white/90 backdrop-blur-sm sm:size-5.5"
              title="Public collection"
            >
              <Globe aria-hidden="true" size={11} />
              <span className="sr-only">Public collection</span>
            </span>
          )}
          {isOrdered && (
            <span
              className="bg-foreground text-background flex size-7 items-center justify-center rounded-md sm:size-5.5"
              title="Ranked collection"
            >
              <ListOrdered aria-hidden="true" size={11} />
              <span className="sr-only">Ranked collection</span>
            </span>
          )}
          {!isPublic && !isPebblyPicks && (
            <span
              className="flex size-7 items-center justify-center rounded-md bg-black/40 text-white/70 backdrop-blur-sm sm:size-5.5 md:hidden"
              title="Private collection"
            >
              <Lock aria-hidden="true" size={11} />
              <span className="sr-only">Private collection</span>
            </span>
          )}
          <span className="inline-flex h-6 items-center rounded-md bg-black/40 px-2.5 text-[11px] font-medium text-white/90 backdrop-blur-sm">
            {itemCount} {itemCount === 1 ? "title" : "titles"}
          </span>
        </div>

        {!isPebblyPicks && (
          <div className="absolute inset-x-0 bottom-0 z-10 flex translate-y-0 justify-end gap-1.5 rounded-b-lg bg-linear-to-t from-black/55 via-black/20 to-transparent p-2.5 pt-8 opacity-100 transition-[opacity,transform] duration-250 ease-out md:pointer-events-none md:translate-y-2 md:opacity-0 md:group-focus-within/card:pointer-events-auto md:group-focus-within/card:translate-y-0 md:group-focus-within/card:opacity-100 md:group-hover/card:pointer-events-auto md:group-hover/card:translate-y-0 md:group-hover/card:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-white/20 bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25 md:size-7"
              aria-label={`Edit ${list.name}`}
            >
              <Pencil aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDuplicate();
              }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-white/20 bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25 md:size-7"
              aria-label={`Duplicate ${list.name}`}
            >
              <Copy aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-white/20 bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-red-500/70 md:size-7"
              aria-label={`Delete ${list.name}`}
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-2 px-0.5">
        <Link to={href} className="min-w-0 flex-1 text-start">
          <h3 className="text-foreground group-hover/card:text-primary truncate text-sm font-semibold transition-colors duration-200">
            {list.name}
          </h3>
          <p className="text-muted-foreground/70 mt-0.5 truncate text-[11px] font-medium">
            {isPebblyPicks ? (
              "AI-curated for you"
            ) : (
              <>
                Updated{" "}
                {new Date(list.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </>
            )}
          </p>
        </Link>
      </div>
    </div>
  );
}
