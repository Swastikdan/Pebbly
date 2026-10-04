import { useCallback } from "react";

import type { WatchlistItem } from "@/hooks/use-watchlist";
import { destructiveToast } from "@/lib/notifications";
import { useRepository } from "@/lib/repository/use-repository";

export function useRemoveFromWatchlistWithUndo(callbacks?: {
  onRemove?: (item: WatchlistItem) => void;
  onUndo?: (item: WatchlistItem) => void;
}) {
  const repository = useRepository();

  return useCallback(
    (item: WatchlistItem, options?: { onUndo?: () => void }) => {
      const payload = {
        title: item.title,
        rating: item.rating,
        image: item.image,
        id: item.external_id,
        media_type: item.type,
        release_date: item.release_date ?? "",
        overview: item.overview,
      };

      callbacks?.onRemove?.(item);

      // 1. Optimistic change to client immediately
      const op = repository.removeWithUndo(payload);

      // 2. Destructive toast with 5s countdown timer
      destructiveToast({
        title: "Removed from watchlist",
        description: item.title,
        timeout: 5000,
        onUndo: () => {
          // Revert client change and cancel pending sync
          op.undo();
          callbacks?.onUndo?.(item);
          options?.onUndo?.();
        },
        onConfirm: () => {
          // Timer ended without undo -> send change to backend (batched)
          void op.commit();
        },
      });
    },
    [repository, callbacks],
  );
}
