import { useUser } from "@clerk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { AIRecommendation } from "@/domain/recommendations";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useAllMediaStates,
  useToggleWatchlistItem,
} from "@/hooks/use-watchlist";
import { queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import {
  filterRenderedRecommendations,
  getDismissKey,
} from "@/lib/recommendation-options";
import {
  getHomepageRecommendations,
  getRecommendationFeedback,
  removeRecommendationFeedback,
  setRecommendationFeedback,
  startHomepageGeneration,
} from "@/server/fns/recommendations";
import { unwrap } from "@/server/schema/common";

export function useHomepageRecommendations() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { hasFeature } = usePermissions();
  const [localDismissedKeys, setLocalDismissedKeys] = useState<Set<string>>(
    new Set(),
  );
  const [localLikedKeys, setLocalLikedKeys] = useState<Set<string>>(new Set());

  const canAccessFeature = isSignedIn && hasFeature("ai-recommendations");

  // Keep the query user-scoped so placeholder data can never display another
  // user's recommendations during an auth transition.
  const recommendationsQuery = useQuery({
    queryKey: queryKeys.recommendations.homepage(user?.id),
    queryFn: () => unwrap(getHomepageRecommendations({ data: {} })),
    enabled: canAccessFeature,
    placeholderData: keepPreviousData,
  });
  const recommendationsData = recommendationsQuery.data;

  const feedbackQuery = useQuery({
    queryKey: queryKeys.recommendations.feedback(user?.id),
    queryFn: () => unwrap(getRecommendationFeedback()),
    enabled: canAccessFeature,
    placeholderData: keepPreviousData,
  });
  const feedbackList = feedbackQuery.data;

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);
  const homepageAttemptRef = useRef(false);

  const refreshHomepage = useCallback(() => {
    void recommendationsQuery.refetch();
    void feedbackQuery.refetch();
  }, [recommendationsQuery, feedbackQuery]);

  useEffect(() => {
    if (!recommendationsData?.needsRefresh) {
      homepageAttemptRef.current = false;
    }
    if (
      !canAccessFeature ||
      !recommendationsData?.needsRefresh ||
      isGeneratingRef.current ||
      homepageAttemptRef.current
    ) {
      return;
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);
    setGenerationError(null);
    homepageAttemptRef.current = true;

    startHomepageGeneration()
      .then((result) => {
        if (result.ok && "error" in result.data) {
          console.error("Homepage generation failed:", result.data.error);
          setGenerationError(result.data.error);
        } else if (!result.ok) {
          console.error("Homepage generation failed:", result.message);
          setGenerationError("api_unavailable");
        }
      })
      .catch((error) => {
        console.error("Homepage generation failed:", error);
        setGenerationError("api_unavailable");
      })
      .finally(() => {
        isGeneratingRef.current = false;
        setIsGenerating(false);
        recordOwnMutation("ai");
        refreshHomepage();
      });
  }, [canAccessFeature, recommendationsData?.needsRefresh, refreshHomepage]);

  const likedKeys = useMemo(() => {
    const set = new Set<string>(localLikedKeys);
    for (const feedback of feedbackList ?? []) {
      if (feedback.feedback === "like") {
        set.add(`${feedback.mediaType}:${feedback.tmdbId}`);
      }
    }
    return set;
  }, [feedbackList, localLikedKeys]);

  const dislikedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const feedback of feedbackList ?? []) {
      if (feedback.feedback === "not_interested") {
        set.add(`${feedback.mediaType}:${feedback.tmdbId}`);
      }
    }
    return set;
  }, [feedbackList]);

  const { allMediaStates } = useAllMediaStates();
  const watchlistKeys = useMemo(() => {
    const set = new Set<string>();
    for (const item of allMediaStates) {
      if (
        item.inWatchlist ||
        item.progressStatus === "watching" ||
        (item.progress ?? 0) > 0
      ) {
        set.add(`${item.type}:${item.external_id}`);
      }
    }
    return set;
  }, [allMediaStates]);

  const recs = useMemo(
    () =>
      filterRenderedRecommendations(recommendationsData?.recommendations, {
        dismissedKeys: localDismissedKeys,
        dislikedKeys,
        watchlistKeys,
        likedKeys,
      }),
    [
      recommendationsData?.recommendations,
      localDismissedKeys,
      dislikedKeys,
      watchlistKeys,
      likedKeys,
    ],
  );

  const toggleWatchlist = useToggleWatchlistItem();

  const handleFeedback = useCallback(
    async (
      rec: AIRecommendation,
      resolvedId: number,
      feedback: "dislike" | "like" | "unlike",
      metadata?: {
        image?: string;
        rating?: number;
        release_date?: string;
        overview?: string;
      },
    ) => {
      const key = getDismissKey(rec);
      const mediaKey = `${rec.mediaType}:${resolvedId}`;

      if (feedback === "dislike") {
        setLocalDismissedKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      } else if (feedback === "like") {
        setLocalLikedKeys((prev) => {
          const next = new Set(prev);
          next.add(mediaKey);
          return next;
        });
      } else {
        setLocalLikedKeys((prev) => {
          const next = new Set(prev);
          next.delete(mediaKey);
          return next;
        });
      }

      if (feedback === "like") {
        toggleWatchlist(
          {
            id: String(resolvedId),
            title: rec.title,
            media_type: rec.mediaType,
            rating: metadata?.rating ?? 0,
            image: metadata?.image ?? "",
            release_date: metadata?.release_date ?? "",
            overview: metadata?.overview,
          },
          false,
        ).catch(console.error);
      } else if (feedback === "unlike") {
        toggleWatchlist(
          {
            id: String(resolvedId),
            title: rec.title,
            media_type: rec.mediaType,
            rating: metadata?.rating ?? 0,
            image: metadata?.image ?? "",
            release_date: metadata?.release_date ?? "",
            overview: metadata?.overview,
          },
          true,
        ).catch(console.error);
      }

      try {
        if (feedback === "unlike") {
          await unwrap(
            removeRecommendationFeedback({
              data: { tmdbId: resolvedId, mediaType: rec.mediaType },
            }),
          );
        } else {
          await unwrap(
            setRecommendationFeedback({
              data: {
                tmdbId: resolvedId,
                mediaType: rec.mediaType,
                title: rec.title,
                feedback: feedback === "dislike" ? "not_interested" : "like",
                image: metadata?.image,
                rating: metadata?.rating,
                release_date: metadata?.release_date,
                overview: metadata?.overview,
              },
            }),
          );
        }
        recordOwnMutation("ai");
        refreshHomepage();
      } catch (error) {
        console.error("Failed to update recommendation feedback:", error);
        if (feedback === "dislike") {
          setLocalDismissedKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        } else if (feedback === "like") {
          setLocalLikedKeys((prev) => {
            const next = new Set(prev);
            next.delete(mediaKey);
            return next;
          });
        } else {
          setLocalLikedKeys((prev) => {
            const next = new Set(prev);
            next.add(mediaKey);
            return next;
          });
        }
      }
    },
    [refreshHomepage, toggleWatchlist],
  );

  return {
    canAccessFeature,
    isLoaded,
    recommendationsData,
    isGenerating,
    generationError,
    recs,
    likedKeys,
    handleFeedback,
  };
}
