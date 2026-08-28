import { useUser } from "@clerk/react";
import { Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { AIRecommendation } from "@/hooks/use-tmdb-verification";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { MediaSkeletonList } from "@/components/media-skeleton-list";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { useResolvedRecommendation } from "@/hooks/use-resolved-recommendation";
import {
  useAllMediaStates,
  useToggleWatchlistItem,
} from "@/hooks/use-watchlist";
import { queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import { cn } from "@/lib/utils";
import {
  getHomepageRecommendations,
  getRecommendationFeedback,
  removeRecommendationFeedback,
  setRecommendationFeedback,
  startHomepageGeneration,
} from "@/server/fns/recommendations";
import { unwrap } from "@/server/schema/common";

const getDismissKey = (rec: AIRecommendation) =>
  `${rec.mediaType}:${rec.tmdbId ?? ""}:${rec.title}`;

const HomepageRecommendationCard = memo(
  ({
    recommendation,
    likedKeys,
    onFeedback,
  }: {
    recommendation: AIRecommendation;
    likedKeys: Set<string>;
    onFeedback: (
      rec: AIRecommendation,
      resolvedId: number,
      feedback: "dislike" | "like" | "unlike",
      metadata?: {
        image?: string;
        rating?: number;
        release_date?: string;
        overview?: string;
      },
    ) => void;
  }) => {
    const { mediaType } = recommendation;
    const { resolvedData, isResolving } =
      useResolvedRecommendation(recommendation);

    if (isResolving) {
      return <MediaCardSkeleton card_type="horizontal" />;
    }

    if (!resolvedData) {
      return null;
    }

    const isLiked = likedKeys.has(`${mediaType}:${resolvedData.id}`);

    return (
      <div className="group/rec-card relative">
        <MediaCard
          card_type="horizontal"
          id={resolvedData.id}
          title={resolvedData.title}
          rating={resolvedData.rating}
          image={resolvedData.posterPath ?? ""}
          poster_path={resolvedData.posterPath ?? ""}
          media_type={mediaType}
          release_date={resolvedData.releaseDate}
          overview={resolvedData.overview}
          is_on_homepage={true}
          relevanceScore={recommendation.relevanceScore}
          hideWatchlistButton={true}
        />

        {/* Always visible on touch devices (no hover to reveal); on
            hover-capable screens they fade in with the card hover. */}
        <div className="absolute top-2 right-2 z-20 flex gap-1.5 opacity-100 transition-opacity duration-200 ease-out [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/rec-card:opacity-100">
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "pressable h-8 w-8 cursor-pointer rounded-lg border shadow-md transition-[color,background-color,border-color,transform] duration-150 active:scale-95 [@media(hover:hover)]:hover:scale-105",
              isLiked
                ? "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700"
                : "border-neutral-700 bg-neutral-900/90 text-white hover:bg-neutral-800",
            )}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onFeedback(
                recommendation,
                resolvedData.id,
                isLiked ? "unlike" : "like",
                {
                  image: resolvedData.posterPath ?? undefined,
                  rating: resolvedData.rating,
                  release_date: resolvedData.releaseDate ?? undefined,
                  overview: resolvedData.overview,
                },
              );
            }}
            title={
              isLiked ? "Remove from Watchlist" : "Add to Watchlist & Like"
            }
          >
            <ThumbsUp
              size={13}
              className={isLiked ? "fill-white text-white" : "text-white"}
            />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="pressable h-8 w-8 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900/90 text-white shadow-md transition-[color,background-color,border-color,transform] duration-150 hover:border-red-600 hover:bg-red-900/90 hover:text-red-200 active:scale-95 [@media(hover:hover)]:hover:scale-105"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onFeedback(recommendation, resolvedData.id, "dislike");
            }}
            title="Dislike"
          >
            <ThumbsDown size={13} />
          </Button>
        </div>
      </div>
    );
  },
);

function RecommendationSectionHeader() {
  return (
    <div className="mb-1 flex items-center justify-between px-4 md:px-0">
      <h2 className="text-h2">Picks For You</h2>
    </div>
  );
}

export function HomepageRecommendations() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { hasFeature } = usePermissions();
  const [localDismissedKeys, setLocalDismissedKeys] = useState<Set<string>>(
    new Set(),
  );
  const [localLikedKeys, setLocalLikedKeys] = useState<Set<string>>(new Set());

  const canAccessFeature = isSignedIn && hasFeature("ai-recommendations");

  // The query key is per-user so keepPreviousData can never surface another
  // user's cached recommendations during sign-in/out transitions.
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
  const isGeneratingRef = useRef(false);
  const homepageAttemptRef = useRef(false);

  const refreshHomepage = useCallback(() => {
    void recommendationsQuery.refetch();
    void feedbackQuery.refetch();
  }, [recommendationsQuery, feedbackQuery]);

  // Auto-generate when the server says the rail needs a refresh. Generation is
  // fully synchronous: the request resolves after the result is already
  // persisted, so we only refresh afterwards - no job tracking. The attempt
  // ref guarantees one attempt per needs-refresh window even if this effect
  // re-runs while `needsRefresh` is still true (e.g. after a rate-limited
  // response, which does not clear the server-side flag).
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
    homepageAttemptRef.current = true;
    startHomepageGeneration()
      .then((result) => {
        if (result.ok && "error" in result.data) {
          console.error("Homepage generation failed:", result.data.error);
        }
      })
      .catch((err) => {
        console.error("Homepage generation failed:", err);
      })
      .finally(() => {
        isGeneratingRef.current = false;
        setIsGenerating(false);
        recordOwnMutation("ai");
        refreshHomepage();
      });
  }, [canAccessFeature, recommendationsData?.needsRefresh, refreshHomepage]);

  const toggleWatchlist = useToggleWatchlistItem();

  const likedKeys = useMemo(() => {
    const set = new Set<string>(localLikedKeys);
    for (const f of feedbackList ?? []) {
      if (f.feedback === "like") {
        set.add(`${f.mediaType}:${f.tmdbId}`);
      }
    }
    return set;
  }, [feedbackList, localLikedKeys]);

  const dislikedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const f of feedbackList ?? []) {
      if (f.feedback === "not_interested") {
        set.add(`${f.mediaType}:${f.tmdbId}`);
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

  const recs = useMemo(() => {
    if (!recommendationsData?.recommendations) return [];
    return recommendationsData.recommendations.filter((r) => {
      if (localDismissedKeys.has(getDismissKey(r))) return false;
      if (r.tmdbId !== null && r.tmdbId !== undefined) {
        const key = `${r.mediaType}:${r.tmdbId}`;
        if (dislikedKeys.has(key)) return false;
        if (watchlistKeys.has(key) && !likedKeys.has(key)) return false;
      }
      return true;
    });
  }, [
    recommendationsData?.recommendations,
    localDismissedKeys,
    watchlistKeys,
    likedKeys,
    dislikedKeys,
  ]);

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
      } else if (feedback === "unlike") {
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
        // The write bumped the AI revision server-side; counting it keeps
        // UserSync from treating our own write as an external change.
        recordOwnMutation("ai");
        refreshHomepage();
      } catch (err) {
        console.error("Failed to update recommendation feedback:", err);
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
        } else if (feedback === "unlike") {
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

  if (!isLoaded) {
    // Reserve the same vertical space as the header + skeleton while Clerk
    // is hydrating, so eligible users don't see the layout grow after auth.
    return (
      // No vertical margin here: the homepage flex column already spaces
      // sections with `gap-10`, so extra `my-*` margins double the gap
      // between "Continue Watching" and this rail.
      <div className="min-h-[280px]" aria-hidden="true">
        <RecommendationSectionHeader />
        <MediaSkeletonList />
      </div>
    );
  }

  if (!canAccessFeature) {
    return null;
  }

  const hasNoWatchHistory =
    recommendationsData?.status === "failed" &&
    (!recommendationsData.recommendations ||
      recommendationsData.recommendations.length === 0);

  if (hasNoWatchHistory) {
    return (
      <section className="border-border/40 bg-card/40 w-full rounded-xl border px-4 py-4 text-left">
        <div className="text-muted-foreground mb-2 flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">
            Personalized Recommendations
          </h3>
        </div>
        <p className="text-muted-foreground max-w-lg text-xs leading-relaxed">
          Add some movies or TV shows to your watchlist to start receiving
          personalized recommendations refreshed twice a day.
        </p>
      </section>
    );
  }

  if (!recommendationsData) {
    return (
      <div className="min-h-[280px]">
        <RecommendationSectionHeader />
        <MediaSkeletonList />
      </div>
    );
  }

  if (recs.length === 0) {
    if (isGenerating) {
      return (
        <div className="min-h-[280px]">
          <RecommendationSectionHeader />
          <MediaSkeletonList />
        </div>
      );
    }
    // Collapsed state: the parent flex column's `gap-10` already provides
    // consistent spacing between siblings, so returning nothing keeps the
    // gap between "Continue Watching" and the next rail uniform.
    return null;
  }

  return (
    <div className="min-h-[280px] w-full">
      <section className="w-full">
        <RecommendationSectionHeader />
        <ScrollContainer isButtonsVisible={true}>
          <div className="flex gap-2 p-4 first:pl-0 last:pr-0">
            {recs.map((rec) => (
              <HomepageRecommendationCard
                key={getDismissKey(rec)}
                recommendation={rec}
                likedKeys={likedKeys}
                onFeedback={handleFeedback}
              />
            ))}
          </div>
        </ScrollContainer>
      </section>
    </div>
  );
}
