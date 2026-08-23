import { useCallback } from "react";

import type { WatchlistItem } from "@/hooks/use-watchlist";
import { toast } from "@/hooks/use-toast-store";
import { useToggleWatchlistItem } from "@/hooks/use-watchlist";

/**
 * Removes a watchlist item immediately and offers an "Undo" that performs
 * the inverse toggle to re-add it.
 *
 * Note: intentionally NOT `destructiveToast` — that util defers the mutation
 * until its countdown expires, while this flow commits right away and reverts
 * on undo. The two are behaviorally distinct, so the original semantics are
 * preserved here.
 */
export function useRemoveFromWatchlistWithUndo() {
  const toggleWatchlist = useToggleWatchlistItem();

  return useCallback(
    (item: WatchlistItem) => {
      const payload = {
        title: item.title,
        rating: item.rating,
        image: item.image,
        id: item.external_id,
        media_type: item.type,
        release_date: item.release_date ?? "",
        overview: item.overview,
      };

      toggleWatchlist(payload, true).catch(console.error);
      toast({
        title: "Removed from watchlist",
        description: item.title,
        action: {
          label: "Undo",
          onClick: () => {
            toggleWatchlist(payload, false).catch(console.error);
          },
        },
      });
    },
    [toggleWatchlist],
  );
}
