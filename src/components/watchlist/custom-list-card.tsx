import {
  Copy,
  Globe,
  ListOrdered,
  Lock,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

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
        "group/card border-border bg-card hover:border-foreground/25 relative flex flex-col rounded-lg border p-3 transition-colors duration-200",
      )}
    >
      <div className="relative">
        <Link
          to={href}
          className="relative block aspect-16/10 w-full overflow-hidden rounded-lg text-left"
          aria-label={`Open ${list.name}`}
        >
          <ListCollage previews={previews} color={list.color} />
        </Link>

        {isPebblyPicks && (
          <span className="bg-foreground text-background absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded-md">
            <Sparkles size={12} />
          </span>
        )}

        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {isPublic && (
            <span
              className="bg-background/95 text-muted-foreground border-border flex size-7 items-center justify-center rounded-md border sm:size-5.5"
              title="Public collection"
            >
              <Globe size={11} />
            </span>
          )}
          {isOrdered && (
            <span
              className="bg-foreground text-background flex size-7 items-center justify-center rounded-md sm:size-5.5"
              title="Ranked collection"
            >
              <ListOrdered size={11} />
            </span>
          )}
          {!isPublic && !isPebblyPicks && (
            <span
              className="bg-background/95 text-muted-foreground/70 border-border flex size-7 items-center justify-center rounded-md border sm:size-5.5 md:hidden"
              title="Private collection"
            >
              <Lock size={11} />
            </span>
          )}
          <span className="bg-background/95 border-border inline-flex h-6 items-center rounded-md border px-2.5 text-[11px] font-medium">
            {itemCount} {itemCount === 1 ? "title" : "titles"}
          </span>
        </div>

        {!isPebblyPicks && (
          <div className="from-background/90 via-background/55 absolute inset-x-0 bottom-0 z-10 flex translate-y-0 justify-end gap-1.5 rounded-b-lg bg-linear-to-t to-transparent p-2.5 pt-8 opacity-100 transition-[opacity,transform] duration-200 md:pointer-events-none md:translate-y-1 md:opacity-0 md:group-focus-within/card:pointer-events-auto md:group-focus-within/card:translate-y-0 md:group-focus-within/card:opacity-100 md:group-hover/card:pointer-events-auto md:group-hover/card:translate-y-0 md:group-hover/card:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }}
              className="bg-background/90 text-muted-foreground border-border hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md border transition-colors md:size-7"
              aria-label={`Edit ${list.name}`}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDuplicate();
              }}
              className="bg-background/90 text-muted-foreground border-border hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md border transition-colors md:size-7"
              aria-label={`Duplicate ${list.name}`}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              className="bg-background/90 text-muted-foreground border-border hover:text-destructive hover:border-destructive/40 flex size-8 cursor-pointer items-center justify-center rounded-md border transition-colors md:size-7"
              aria-label={`Delete ${list.name}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-2 px-1">
        <Link to={href} className="min-w-0 flex-1 text-left">
          <h3 className="text-foreground group-hover/card:text-primary truncate text-base font-bold tracking-tight transition-colors duration-250 sm:text-sm">
            {list.name}
          </h3>
          <p className="text-muted-foreground/80 mt-0.5 truncate text-xs font-medium sm:text-[10px]">
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
