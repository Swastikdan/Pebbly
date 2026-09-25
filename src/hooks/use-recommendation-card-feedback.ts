import { useUser } from "@clerk/react";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { MediaType } from "@/domain/media";
import { useToggleWatchlistItem } from "@/hooks/use-watchlist";
import { broadcastMutation } from "@/lib/cross-tab-sync";
import { toast } from "@/lib/notifications";
import { queryKeys } from "@/lib/query/keys";
import { logError } from "@/lib/utils";
import {
  getRecommendationFeedback,
  removeRecommendationFeedback,
  setRecommendationFeedback,
} from "@/server/fns/recommendations";
import { unwrap } from "@/server/schema/common";

const GUEST_FEEDBACK_KEY = "pebbly:guest_rec_feedback";

type GuestFeedbackEntry = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  feedback: "like" | "not_interested";
  updatedAt: number;
};

function readGuestFeedback(): Record<string, GuestFeedbackEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GUEST_FEEDBACK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeGuestFeedback(data: Record<string, GuestFeedbackEntry>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_FEEDBACK_KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded
  }
}

export type FeedbackTarget = {
  id: number;
  mediaType: MediaType;
  title: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

export function useRecommendationCardFeedback() {
  const { isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const toggleWatchlist = useToggleWatchlistItem();

  const [guestFeedback, setGuestFeedback] =
    useState<Record<string, GuestFeedbackEntry>>(readGuestFeedback);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const serverFeedbackQuery = useQuery({
    queryKey: queryKeys.recommendations.feedback(user?.id),
    queryFn: () => unwrap(getRecommendationFeedback()),
    enabled: !!isSignedIn && !!user?.id,
  });

  const feedbackList = serverFeedbackQuery.data ?? [];

  const likedKeys = useMemo(() => {
    const set = new Set<string>();
    if (isSignedIn) {
      for (const row of feedbackList) {
        if (row.feedback === "like") {
          set.add(`${row.mediaType}:${row.tmdbId}`);
        }
      }
    } else {
      for (const entry of Object.values(guestFeedback)) {
        if (entry.feedback === "like") {
          set.add(`${entry.mediaType}:${entry.tmdbId}`);
        }
      }
    }
    return set;
  }, [isSignedIn, feedbackList, guestFeedback]);

  const dislikedKeys = useMemo(() => {
    const set = new Set<string>();
    if (isSignedIn) {
      for (const row of feedbackList) {
        if (row.feedback === "not_interested" || row.feedback === "dislike") {
          set.add(`${row.mediaType}:${row.tmdbId}`);
        }
      }
    } else {
      for (const entry of Object.values(guestFeedback)) {
        if (entry.feedback === "not_interested") {
          set.add(`${entry.mediaType}:${entry.tmdbId}`);
        }
      }
    }
    return set;
  }, [isSignedIn, feedbackList, guestFeedback]);

  const isLiked = useCallback(
    (id: number, mediaType: MediaType) => likedKeys.has(`${mediaType}:${id}`),
    [likedKeys],
  );

  const isDisliked = useCallback(
    (id: number, mediaType: MediaType) =>
      dislikedKeys.has(`${mediaType}:${id}`) ||
      dismissedKeys.has(`${mediaType}:${id}`),
    [dislikedKeys, dismissedKeys],
  );

  const handleMoreLikeThis = useCallback(
    async (item: FeedbackTarget) => {
      const key = `${item.mediaType}:${item.id}`;
      const currentlyLiked = likedKeys.has(key);

      if (currentlyLiked) {
        // Toggle off
        if (isSignedIn) {
          try {
            await unwrap(
              removeRecommendationFeedback({
                data: { tmdbId: item.id, mediaType: item.mediaType },
              }),
            );
            void queryClient.invalidateQueries({
              queryKey: queryKeys.recommendations.feedback(user?.id),
            });
            broadcastMutation("ai");
          } catch (error) {
            logError("remove recommendation feedback", error);
          }
        } else {
          setGuestFeedback((prev) => {
            const next = { ...prev };
            delete next[key];
            writeGuestFeedback(next);
            return next;
          });
        }
        return;
      }

      // Add like
      if (isSignedIn) {
        try {
          await unwrap(
            setRecommendationFeedback({
              data: {
                tmdbId: item.id,
                mediaType: item.mediaType,
                title: item.title,
                feedback: "like",
                image: item.image,
                rating: item.rating,
                release_date: item.release_date,
                overview: item.overview,
              },
            }),
          );
          void queryClient.invalidateQueries({
            queryKey: queryKeys.recommendations.feedback(user?.id),
          });
          broadcastMutation("ai");
        } catch (error) {
          logError("save recommendation feedback", error);
        }
      } else {
        setGuestFeedback((prev) => {
          const entry: GuestFeedbackEntry = {
            tmdbId: item.id,
            mediaType: item.mediaType,
            title: item.title,
            feedback: "like",
            updatedAt: Date.now(),
          };
          const next: Record<string, GuestFeedbackEntry> = {
            ...prev,
            [key]: entry,
          };
          writeGuestFeedback(next);
          return next;
        });
        // Also add to watchlist optimistically for guests
        void toggleWatchlist(
          {
            id: String(item.id),
            title: item.title,
            media_type: item.mediaType,
            rating: item.rating ?? 0,
            image: item.image ?? "",
            release_date: item.release_date ?? "",
            overview: item.overview,
          },
          false,
        );
      }

      toast({
        title: "More like this",
        description: `We'll recommend more titles like "${item.title}".`,
      });
    },
    [isSignedIn, user?.id, queryClient, likedKeys, toggleWatchlist],
  );

  const handleNotThis = useCallback(
    async (item: FeedbackTarget) => {
      const key = `${item.mediaType}:${item.id}`;

      // Optimistically hide card
      setDismissedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      if (isSignedIn) {
        try {
          await unwrap(
            setRecommendationFeedback({
              data: {
                tmdbId: item.id,
                mediaType: item.mediaType,
                title: item.title,
                feedback: "not_interested",
                image: item.image,
                rating: item.rating,
                release_date: item.release_date,
                overview: item.overview,
              },
            }),
          );
          void queryClient.invalidateQueries({
            queryKey: queryKeys.recommendations.feedback(user?.id),
          });
          broadcastMutation("ai");
        } catch (error) {
          logError("save recommendation feedback", error);
        }
      } else {
        setGuestFeedback((prev) => {
          const entry: GuestFeedbackEntry = {
            tmdbId: item.id,
            mediaType: item.mediaType,
            title: item.title,
            feedback: "not_interested",
            updatedAt: Date.now(),
          };
          const next: Record<string, GuestFeedbackEntry> = {
            ...prev,
            [key]: entry,
          };
          writeGuestFeedback(next);
          return next;
        });
      }

      toast({
        title: "Preference saved",
        description: `Got it. Fewer titles like "${item.title}" will be suggested.`,
      });
    },
    [isSignedIn, user?.id, queryClient],
  );

  return {
    isLiked,
    isDisliked,
    dismissedKeys,
    handleMoreLikeThis,
    handleNotThis,
  };
}
