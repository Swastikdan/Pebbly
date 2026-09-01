import { Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo } from "react";

import type { AIRecommendation } from "@/domain/recommendations";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { MediaSkeletonList } from "@/components/media-skeleton-list";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import { useHomepageRecommendations } from "@/hooks/use-homepage-recommendations";
import { useResolvedRecommendation } from "@/hooks/use-resolved-recommendation";
import { describeGenerationError } from "@/lib/generation-errors";
import { getDismissKey } from "@/lib/recommendation-options";
import { cn } from "@/lib/utils";

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

    if (isResolving) return <MediaCardSkeleton card_type="horizontal" />;
    if (!resolvedData) return null;

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

        <div className="absolute top-2 right-2 z-20 flex gap-1.5 opacity-100 transition-opacity duration-200 ease-out [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/rec-card:opacity-100">
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "pressable h-8 w-8 cursor-pointer rounded-md border transition-[color,background-color,border-color,transform] duration-150 active:scale-95 [@media(hover:hover)]:hover:scale-105",
              isLiked
                ? "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700"
                : "border-neutral-700 bg-neutral-900/90 text-white hover:bg-neutral-800",
            )}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
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
            className="pressable h-8 w-8 cursor-pointer rounded-md border border-neutral-700 bg-neutral-900/90 text-white transition-[color,background-color,border-color,transform] duration-150 hover:border-red-600 hover:bg-red-900/90 hover:text-red-200 active:scale-95 [@media(hover:hover)]:hover:scale-105"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
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

function GenerationErrorNotice({ error }: { error: string }) {
  return (
    <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-xs">
      {describeGenerationError(error, {
        rate_limited:
          "Please wait a couple minutes before refreshing personalized recommendations.",
      })}
    </div>
  );
}

export function HomepageRecommendations() {
  const {
    canAccessFeature,
    isLoaded,
    recommendationsData,
    isGenerating,
    generationError,
    recs,
    likedKeys,
    handleFeedback,
  } = useHomepageRecommendations();

  if (!isLoaded) {
    return (
      <div className="min-h-[280px]" aria-hidden="true">
        <RecommendationSectionHeader />
        <MediaSkeletonList />
      </div>
    );
  }

  if (!canAccessFeature) return null;

  const hasNoWatchHistory =
    recommendationsData?.status === "failed" &&
    (!recommendationsData.recommendations ||
      recommendationsData.recommendations.length === 0);

  if (hasNoWatchHistory) {
    return (
      <section className="border-border/40 bg-card/40 w-full rounded-lg border px-4 py-4 text-left">
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
        {generationError && <GenerationErrorNotice error={generationError} />}
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
    if (generationError) {
      return (
        <section className="w-full space-y-2">
          <RecommendationSectionHeader />
          <GenerationErrorNotice error={generationError} />
        </section>
      );
    }
    return null;
  }

  return (
    <div className="min-h-[280px] w-full">
      {generationError && <GenerationErrorNotice error={generationError} />}
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
