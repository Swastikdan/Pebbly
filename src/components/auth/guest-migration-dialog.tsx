import { useUser } from "@clerk/react";
import { usePostHog } from "@posthog/react";
import { ArrowRightLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchWatchlistList } from "@/lib/data/watchlist-queries";
import {
  buildMigrationPayload,
  clearGuestStores,
  computeMigrationPreview,
} from "@/lib/guest-migration";
import { toast } from "@/lib/notifications";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
import { logError } from "@/lib/utils";
import { planImportBatches } from "@/lib/watchlist-import";
import { importWatchlist as importWatchlistFn } from "@/server/fns/import-export";
import { unwrap } from "@/server/schema/common";
import { useLocalListsStore } from "@/stores/local-lists-store";
import { useLocalProgressStore } from "@/stores/local-progress-store";
import { useWatchlistStore } from "@/stores/watchlist-store";

const DISMISSED_SESSION_KEY_PREFIX = "pebbly:migration_dismissed:";

export function openGuestMigrationModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pebbly:open-migration"));
  }
}

export function GuestMigrationDialog() {
  const { isSignedIn, isLoaded, user } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const repository = useRepository();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"idle" | "migrating" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleOpen = () => {
      setStep("idle");
      setOpen(true);
    };
    window.addEventListener("pebbly:open-migration", handleOpen);
    return () => {
      window.removeEventListener("pebbly:open-migration", handleOpen);
    };
  }, []);

  const localMedia = useWatchlistStore((s) => s.mediaState);
  const localEpisodes = useLocalProgressStore((s) => s.watchedEpisodes);
  const localLists = useLocalListsStore((s) => s.lists);
  const localListItems = useLocalListsStore((s) => s.listItems);

  // Fetch existing remote watchlist items for conflict comparison
  const remoteQuery = useQuery({
    queryKey: queryKeys.watchlist.list(undefined, user?.id),
    queryFn: () => fetchWatchlistList(queryClient, user?.id),
    enabled: !!isSignedIn && !!user?.id,
  });

  const preview = useMemo(
    () =>
      computeMigrationPreview(
        localMedia,
        localEpisodes,
        localLists,
        remoteQuery.data,
      ),
    [localMedia, localEpisodes, localLists, remoteQuery.data],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !preview.hasData) {
      setOpen(false);
      return;
    }

    try {
      const dismissed = sessionStorage.getItem(
        `${DISMISSED_SESSION_KEY_PREFIX}${user.id}`,
      );
      if (dismissed === "true") {
        setOpen(false);
        return;
      }
    } catch {
      // Storage unavailable
    }

    // Open migration modal when guest data exists and has not been dismissed in this session
    setOpen(true);
  }, [isLoaded, isSignedIn, user, preview.hasData]);

  const handleDismiss = () => {
    if (user?.id) {
      try {
        sessionStorage.setItem(
          `${DISMISSED_SESSION_KEY_PREFIX}${user.id}`,
          "true",
        );
      } catch {
        // Storage unavailable
      }
    }
    setOpen(false);
  };

  const handleMigrate = async () => {
    if (step === "migrating") return;
    setStep("migrating");
    setErrorMessage(null);

    try {
      // 1. Build and send watchlist and episode batches
      const { items, watchedEpisodes } = buildMigrationPayload(
        localMedia,
        localEpisodes,
      );

      if (items.length > 0 || watchedEpisodes.length > 0) {
        const batches = planImportBatches(items, watchedEpisodes);
        for (const batch of batches) {
          await unwrap(importWatchlistFn({ data: batch }));
        }
      }

      // 2. Migrate custom collections if any
      if (localLists.length > 0) {
        for (const guestList of localLists) {
          const newListId = await repository.createList({
            name: guestList.name,
            color: guestList.color,
            visibility: "private",
            listType: "custom",
            description: guestList.description,
            sortType: guestList.sortType ?? "unordered",
          });

          const itemsForList = localListItems.filter(
            (i) => i.listId === guestList._id,
          );
          for (const item of itemsForList) {
            await repository.toggleListItem({
              listId: newListId,
              tmdbId: item.tmdbId,
              mediaType: item.mediaType,
              title: item.title,
              image: item.image,
              backdrop: item.backdrop,
              rating: item.rating,
              release_date: item.release_date,
              overview: item.overview,
            });
          }
        }
      }

      // 3. Clear local guest data ONLY after confirmed success
      clearGuestStores();

      // 4. Invalidate user caches
      if (user?.id) {
        await Promise.allSettled([
          queryClient.invalidateQueries({
            queryKey: queryKeys.watchlist.list(undefined, user.id),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.watchlist.allEpisodes(user.id),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.lists.all(user.id),
          }),
        ]);
      }

      posthog?.capture("guest_migration_completed", {
        titles_count: items.length,
        episodes_count: watchedEpisodes.length,
        conflicts_count: preview.conflictingTitles,
        lists_count: localLists.length,
      });

      toast({
        title: "Guest data merged",
        description: `Successfully added ${items.length} titles to your account.`,
        type: "success",
      });

      setStep("success");
    } catch (err) {
      logError("guest migration", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to merge data into your account. Please try again.",
      );
      setStep("error");
    }
  };

  if (!open || !isSignedIn) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && step !== "migrating") {
          handleDismiss();
        }
      }}
    >
      <DialogPopup className="max-w-md p-6">
        <DialogHeader className="space-y-2 text-start">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <ArrowRightLeft aria-hidden="true" size={18} />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Merge Guest Library
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                You saved titles while browsing as a guest.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "idle" && (
          <div className="space-y-4 pt-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              We found items in your browser. Would you like to merge them into
              your account so your watchlist and progress stay synced?
            </p>

            <div className="border-border bg-card/50 grid grid-cols-2 gap-2 rounded-lg border p-3">
              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[11px] font-medium">
                  New Titles
                </span>
                <p className="text-foreground text-base font-bold">
                  {preview.newTitles}
                </p>
              </div>

              {preview.conflictingTitles > 0 && (
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px] font-medium">
                    Account Overlaps
                  </span>
                  <p className="text-foreground text-base font-bold">
                    {preview.conflictingTitles}
                  </p>
                </div>
              )}

              {preview.watchedEpisodesCount > 0 && (
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px] font-medium">
                    Watched Episodes
                  </span>
                  <p className="text-foreground text-base font-bold">
                    {preview.watchedEpisodesCount}
                  </p>
                </div>
              )}

              {preview.listsCount > 0 && (
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px] font-medium">
                    Collections
                  </span>
                  <p className="text-foreground text-base font-bold">
                    {preview.listsCount}
                  </p>
                </div>
              )}
            </div>

            {preview.conflictingTitles > 0 && (
              <p className="text-muted-foreground/80 text-[11px] italic">
                Overlapping titles will be updated with your latest progress and
                reaction without creating duplicate rows.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-xs"
              >
                Keep Account Only
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleMigrate}
                className="text-xs font-semibold"
              >
                Merge into Account
              </Button>
            </div>
          </div>
        )}

        {step === "migrating" && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <Loader2
              aria-hidden="true"
              size={28}
              className="text-primary animate-spin"
            />
            <div className="space-y-1">
              <p className="text-foreground text-sm font-semibold">
                Merging your library...
              </p>
              <p className="text-muted-foreground text-xs">
                Syncing watchlist, progress, and collections into your account.
              </p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <CheckCircle2
              aria-hidden="true"
              size={36}
              className="text-emerald-500"
            />
            <div className="space-y-1">
              <p className="text-foreground text-sm font-semibold">
                Migration Complete!
              </p>
              <p className="text-muted-foreground text-xs">
                Your guest watchlist and history are now safely in your account.
              </p>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  void navigate({ to: "/watchlist" });
                }}
                className="text-xs font-semibold"
              >
                View Watchlist
              </Button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4 pt-4">
            <p className="text-destructive-foreground text-xs font-medium">
              {errorMessage ??
                "Something went wrong while merging. Your local data has been preserved."}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleMigrate}
                className="text-xs font-semibold"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  );
}
