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
        "group/card border-border/45 dark:border-border/20 bg-card/85 dark:bg-card/40 hover:border-border/80 hover:shadow-primary/5 relative flex flex-col rounded-xl border p-3 transition-[transform,border-color,box-shadow] duration-250 hover:-translate-y-0.5 hover:shadow-lg",
      )}
    >
      <div className="relative">
        <Link
          to={href}
          className="relative block aspect-[16/10] w-full overflow-hidden rounded-xl text-left"
          aria-label={`Open ${list.name}`}
        >
          <ListCollage previews={previews} color={list.color} />
        </Link>

        {isPebblyPicks && (
          <span className="bg-foreground text-background absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded-lg shadow-md">
            <Sparkles size={12} />
          </span>
        )}

        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {isPublic && (
            <span
              className="bg-background/95 text-muted-foreground ring-border/20 flex size-7 items-center justify-center rounded-xl shadow-md ring-1 backdrop-blur-md sm:size-[22px]"
              title="Public collection"
            >
              <Globe size={11} />
            </span>
          )}
          {isOrdered && (
            <span
              className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg shadow-md sm:size-[22px]"
              title="Ranked collection"
            >
              <ListOrdered size={11} />
            </span>
          )}
          {!isPublic && !isPebblyPicks && (
            <span
              className="bg-background/95 text-muted-foreground/70 ring-border/20 flex size-7 items-center justify-center rounded-xl shadow-md ring-1 backdrop-blur-md sm:size-[22px] md:hidden"
              title="Private collection"
            >
              <Lock size={11} />
            </span>
          )}
          <span className="bg-background/95 ring-border/20 inline-flex h-6 items-center rounded-md px-2.5 text-[11px] font-bold tracking-tight shadow-md ring-1 backdrop-blur-md">
            {itemCount} {itemCount === 1 ? "title" : "titles"}
          </span>
        </div>

        {!isPebblyPicks && (
          <div className="from-background/90 via-background/55 absolute inset-x-0 bottom-0 z-10 flex translate-y-0 justify-end gap-1.5 rounded-b-xl bg-gradient-to-t to-transparent p-2.5 pt-8 opacity-100 transition-[opacity,transform] duration-200 md:pointer-events-none md:translate-y-1 md:opacity-0 md:group-focus-within/card:pointer-events-auto md:group-focus-within/card:translate-y-0 md:group-focus-within/card:opacity-100 md:group-hover/card:pointer-events-auto md:group-hover/card:translate-y-0 md:group-hover/card:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }}
              className="bg-background/80 text-muted-foreground ring-border/30 hover:text-foreground hover:ring-border/60 flex size-8 cursor-pointer items-center justify-center rounded-lg shadow-sm ring-1 backdrop-blur-md transition-colors md:size-7"
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
              className="bg-background/80 text-muted-foreground ring-border/30 hover:text-foreground hover:ring-border/60 flex size-8 cursor-pointer items-center justify-center rounded-lg shadow-sm ring-1 backdrop-blur-md transition-colors md:size-7"
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
              className="bg-background/80 text-muted-foreground ring-border/30 hover:text-destructive hover:ring-destructive/40 flex size-8 cursor-pointer items-center justify-center rounded-lg shadow-sm ring-1 backdrop-blur-md transition-colors md:size-7"
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
