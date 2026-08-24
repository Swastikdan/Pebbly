import { useCallback } from "react";

import type { WatchlistItem } from "@/hooks/use-watchlist";
import { toast } from "@/hooks/use-toast-store";
import { useToggleWatchlistItem } from "@/hooks/use-watchlist";

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
