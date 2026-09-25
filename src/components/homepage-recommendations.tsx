import { Sparkles } from "lucide-react";
import { memo } from "react";

import type { AIRecommendation } from "@/domain/recommendations";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { MediaSkeletonList } from "@/components/media-skeleton-list";
import { TasteProfileDialog } from "@/components/recommendations/taste-profile-dialog";
import { ScrollContainer } from "@/components/scroll-container";
import { useHomepageRecommendations } from "@/hooks/use-homepage-recommendations";
import { useResolvedRecommendation } from "@/hooks/use-resolved-recommendation";
import { describeGenerationError } from "@/lib/generation-errors";
import { getDismissKey } from "@/lib/recommendation-options";

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
        reasoning={recommendation.reasoning}
        hideWatchlistButton={true}
        feedbackActions={{
          isLiked,
          onMoreLikeThis: () => {
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
          },
          onNotThis: () => {
            onFeedback(recommendation, resolvedData.id, "dislike");
          },
        }}
      />
    );
  },
);

function RecommendationSectionHeader() {
  return (
    <div className="mb-2 flex items-center justify-between px-4 md:px-0">
      <h2 className="text-h2">Picks For You</h2>
      <TasteProfileDialog />
    </div>
  );
}

function GenerationErrorNotice({ error }: { error: string }) {
  const message = describeGenerationError(error, {
    rate_limited:
      "Please wait a couple minutes before refreshing personalized recommendations.",
  });
  // Availability failures intentionally have no copy; keep the space empty.
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-destructive/50 bg-destructive/10 text-destructive-foreground rounded-lg border px-4 py-3 text-xs"
    >
      {message}
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
      <div className="min-h-70" aria-hidden="true">
        <RecommendationSectionHeader />
        <MediaSkeletonList />
      </div>
    );
  }

  if (!canAccessFeature) return null;
  if (generationError || recommendationsData?.status === "failed") return null;

  const hasNoWatchHistory =
    recommendationsData?.status === "failed" &&
    (!recommendationsData.recommendations ||
      recommendationsData.recommendations.length === 0);

  if (hasNoWatchHistory) {
    return (
      <section className="border-border/40 bg-card/40 w-full rounded-lg border px-4 py-4 text-start">
        <div className="text-muted-foreground mb-2 flex items-center gap-2">
          <Sparkles aria-hidden="true" size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">
            Personalized Recommendations
          </h3>
        </div>
        <p className="text-muted-foreground max-w-[65ch] text-[13px] leading-relaxed text-pretty">
          Add some movies or TV shows to your watchlist to start receiving
          personalized recommendations refreshed twice a day.
        </p>
        {generationError && <GenerationErrorNotice error={generationError} />}
      </section>
    );
  }

  if (!recommendationsData) {
    return (
      <div className="min-h-70">
        <RecommendationSectionHeader />
        <MediaSkeletonList />
      </div>
    );
  }

  if (recs.length === 0) {
    if (isGenerating) {
      return (
        <div className="min-h-70">
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
    <div className="min-h-70 w-full">
      {generationError && <GenerationErrorNotice error={generationError} />}
      <section className="w-full">
        <RecommendationSectionHeader />
        <ScrollContainer isButtonsVisible={true}>
          <div className="flex gap-2 p-4 first:ps-0 last:pe-0">
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
