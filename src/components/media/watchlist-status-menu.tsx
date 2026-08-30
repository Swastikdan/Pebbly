import { SignInButton, useUser } from "@clerk/react";
import {
  Bookmark,
  Check,
  ChevronDown,
  Clock,
  Eye,
  ListPlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import type { MediaType } from "@/domain/media";
import type { ProgressStatus, ReactionStatus } from "@/domain/watchlist";
import { CustomListDialog } from "@/components/custom-list-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Menu, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { getProgressOption, REACTION_OPTIONS } from "@/constants/watchlist";
import { useCustomLists, useItemLists } from "@/hooks/use-custom-lists";
import { useRepository } from "@/lib/repository/use-repository";
import { cn } from "@/lib/utils";

export type MediaMetadataForList = {
  title?: string;
  image?: string;
  backdrop?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

export function WatchlistStatusMenu({
  isOnWatchlist,
  progressStatus,
  reaction,
  mediaType,
  tmdbId,
  onAdd,
  onStatusChange,
  onReactionChange,
  onRemove,
  metadata,
}: {
  isOnWatchlist: boolean;
  progressStatus: ProgressStatus | null;
  reaction: ReactionStatus | null;
  mediaType: MediaType;
  tmdbId: number;
  onAdd: () => void;
  onStatusChange: (status: ProgressStatus) => void;
  onReactionChange: (reaction: ReactionStatus | null) => void;
  onRemove: () => void;
  metadata?: MediaMetadataForList;
}) {
  const [open, setOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);

  const currentStatus = progressStatus ?? "watch-later";
  const currentOption = getProgressOption(currentStatus);
  const StatusIcon = isOnWatchlist ? currentOption.icon : Bookmark;

  return (
    <div className="flex items-center gap-2">
      {!isOnWatchlist ? (
        <Button
          variant="secondary"
          className="border-border hover:bg-secondary/80 flex h-10 w-10 items-center justify-center gap-0 border px-0 text-xs font-semibold transition-[color,background-color,border-color] sm:w-auto sm:min-w-fit sm:gap-2 sm:px-4"
          onClick={onAdd}
        >
          <Bookmark size={16} />
          <span className="hidden sm:inline">Add to Watchlist</span>
        </Button>
      ) : (
        <Menu open={open} onOpenChange={setOpen}>
          <MenuTrigger
            render={
              <Button
                variant="secondary"
                className="bg-primary/10 hover:bg-primary/15 text-primary flex h-10 w-10 cursor-pointer items-center justify-center gap-0 px-0 text-xs font-semibold transition-[color,background-color,border-color] sm:w-auto sm:min-w-fit sm:gap-2 sm:px-4"
              />
            }
          >
            <StatusIcon size={16} className="text-primary" />
            <span className="hidden sm:inline">{currentOption.label}</span>
            <ChevronDown
              size={14}
              className={cn(
                "hidden opacity-75 transition-transform duration-200 sm:inline",
                open && "rotate-180",
              )}
            />
          </MenuTrigger>
          <MenuPopup
            align="end"
            className="border-border bg-popover w-80 rounded-xl border p-0 shadow-xl"
          >
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
              <span className="text-muted-foreground text-xs font-bold tracking-wider">
                Watchlist Status
              </span>
            </div>

            <div className="space-y-0.5 p-2.5">
              <StatusButton
                active={currentStatus === "watch-later"}
                onClick={() => onStatusChange("watch-later")}
              >
                <Clock
                  size={14}
                  className={
                    currentStatus === "watch-later"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }
                />
                <span>Watch Later</span>
              </StatusButton>
              <StatusButton
                active={currentStatus === "watching"}
                onClick={() => onStatusChange("watching")}
              >
                <Eye
                  size={14}
                  className={
                    currentStatus === "watching"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }
                />
                <span>Watching</span>
              </StatusButton>
              <StatusButton
                active={currentStatus === "done"}
                onClick={() => onStatusChange("done")}
              >
                <Check
                  size={14}
                  className={
                    currentStatus === "done"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }
                />
                <span>Done</span>
              </StatusButton>
              {mediaType === "tv" && (
                <StatusButton
                  active={currentStatus === "dropped"}
                  onClick={() => onStatusChange("dropped")}
                >
                  <X
                    size={14}
                    className={
                      currentStatus === "dropped"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  />
                  <span>Dropped</span>
                </StatusButton>
              )}
            </div>

            <div className="border-border space-y-2 border-t p-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase">
                  Reaction
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {REACTION_OPTIONS.map((option) => {
                  const isSelected = reaction === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 transition-[color,background-color,border-color] duration-150",
                        isSelected
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-secondary/20 border-border/30 hover:border-border/60 hover:bg-secondary/50 text-muted-foreground hover:text-foreground",
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onReactionChange(isSelected ? null : option.value);
                      }}
                    >
                      <option.icon
                        size={18}
                        className={
                          isSelected ? "text-primary" : "text-muted-foreground"
                        }
                      />
                      <span className="text-[9px] font-bold tracking-tight">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-border border-t p-2.5">
              <button
                type="button"
                className="text-destructive hover:bg-destructive/10 border-destructive/25 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors"
                onClick={() => {
                  onRemove();
                  setOpen(false);
                }}
              >
                <Trash2 size={14} />
                <span>Delete from Watchlist</span>
              </button>
            </div>
          </MenuPopup>
        </Menu>
      )}

      <Button
        variant="secondary"
        className="border-border hover:bg-secondary/80 flex h-10 w-10 cursor-pointer items-center justify-center gap-0 border px-0 text-xs font-semibold transition-[color,background-color,border-color] sm:w-auto sm:min-w-fit sm:gap-2 sm:px-4"
        onClick={() => setListDialogOpen(true)}
      >
        <ListPlus size={16} />
        <span className="hidden sm:inline">Add to Collection</span>
      </Button>

      <SilentErrorBoundary>
        <AddToListDialog
          open={listDialogOpen}
          onOpenChange={setListDialogOpen}
          tmdbId={tmdbId}
          mediaType={mediaType}
          metadata={metadata}
        />
      </SilentErrorBoundary>
    </div>
  );
}

function StatusButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "border-border flex w-full cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-semibold transition-[color,background-color,border-color] duration-200",
        active
          ? "bg-primary/10 text-primary border-primary/30 font-bold"
          : "hover:bg-secondary/40 text-muted-foreground hover:text-foreground",
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function AddToListDialog({
  open,
  onOpenChange,
  tmdbId,
  mediaType,
  metadata,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tmdbId: number;
  mediaType: MediaType;
  metadata?: MediaMetadataForList;
}) {
  const { lists } = useCustomLists();
  const itemLists = useItemLists(tmdbId, mediaType);
  const { isSignedIn } = useUser();
  const { toggleListItem } = useRepository();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const safeList = lists ?? [];
  const safeItemLists = itemLists ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPopup className="overflow-hidden rounded-xl p-0 sm:max-w-[380px]">
          <div className="px-6 pt-6 pb-2">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-semibold tracking-tight">
                My Collections
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {isSignedIn
                  ? "Add or remove this title from your collections."
                  : "Sign in to organize titles into your own collections."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {!isSignedIn ? (
            <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-6 text-center">
              <p className="text-muted-foreground text-xs">
                Collections belong to your account. They stay private by default
                and are shareable when you want.
              </p>
              <SignInButton mode="modal">
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs font-semibold"
                >
                  Sign In
                </Button>
              </SignInButton>
            </div>
          ) : (
            <>
              <div className="px-6">
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {safeList.length === 0 && (
                    <p className="text-muted-foreground py-6 text-center text-sm">
                      No collections yet. Create one to get started.
                    </p>
                  )}

                  {safeList
                    .filter((list) => list.listType !== "pebbly-picks")
                    .map((list) => {
                      const isInList = safeItemLists.includes(list._id);
                      return (
                        <button
                          key={list._id}
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl border border-transparent px-4 py-3 text-sm transition-[color,background-color,border-color] duration-200",
                            isInList
                              ? "bg-primary/[0.03] border-primary/10 text-foreground font-semibold"
                              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                          )}
                          onClick={() =>
                            toggleListItem({
                              listId: list._id,
                              tmdbId,
                              mediaType,
                              title: metadata?.title,
                              image: metadata?.image,
                              backdrop: metadata?.backdrop,
                              rating: metadata?.rating,
                              release_date: metadata?.release_date,
                              overview: metadata?.overview,
                            })
                          }
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-[color,background-color,border-color] duration-200",
                                isInList
                                  ? "border-primary bg-primary text-primary-foreground scale-105"
                                  : "border-muted-foreground/30 bg-transparent",
                              )}
                            >
                              {isInList && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span className="truncate">{list.name}</span>
                          </div>
                          {list.color && (
                            <span
                              className="size-2.5 shrink-0 rounded-full shadow-sm"
                              style={{ backgroundColor: list.color }}
                            />
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="px-6 pt-3 pb-6">
                <Button
                  type="button"
                  variant="outline"
                  className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground h-auto w-full justify-center gap-2 border-dashed py-2.5 text-sm font-medium transition-colors"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus size={16} />
                  Create New Collection
                </Button>
              </div>
            </>
          )}
        </DialogPopup>
      </Dialog>

      <CustomListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        autoAddMedia={{
          tmdbId,
          mediaType,
          title: metadata?.title,
          image: metadata?.image,
          backdrop: metadata?.backdrop,
          rating: metadata?.rating,
          release_date: metadata?.release_date,
          overview: metadata?.overview,
        }}
      />
    </>
  );
}
