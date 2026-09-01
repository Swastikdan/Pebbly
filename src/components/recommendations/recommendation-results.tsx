import { ArrowUpRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import type { AIRecommendation } from "@/domain/recommendations";
import type { RecommendationHistoryEntry } from "@/hooks/use-recommendations";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { formatTimestamp } from "@/components/recommendations/recommendation-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaGrid } from "@/components/ui/media-grid";
import { useResolvedRecommendation } from "@/hooks/use-resolved-recommendation";
import { cn } from "@/lib/utils";

export function RecommendationResults({
  entry,
  updateVerified,
}: {
  entry: RecommendationHistoryEntry;
  updateVerified: (id: string, recs: AIRecommendation[]) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <Badge variant="outline" className="text-[10px] font-medium capitalize">
          {entry.generationType === "genre"
            ? "By Genre"
            : entry.generationType === "list"
              ? "Custom List"
              : "Watchlist"}
        </Badge>
        {entry.genrePreference && <span>{entry.genrePreference}</span>}
        {entry.mediaTypePreference && (
          <span className="capitalize">
            {entry.mediaTypePreference === "movie" ? "Movies only" : "TV only"}
          </span>
        )}
        <span>
          {entry.inputStats.movieCount} movies, {entry.inputStats.tvCount} TV
          shows
        </span>
        <span>{formatTimestamp(entry.createdAt)}</span>
      </div>

      <RecommendationCardGrid entry={entry} updateVerified={updateVerified} />
    </div>
  );
}

function RecommendationCardGrid({
  entry,
  updateVerified,
}: {
  entry: RecommendationHistoryEntry;
  updateVerified: (id: string, recs: AIRecommendation[]) => Promise<void>;
}) {
  const verifiedMapRef = useRef<Map<number, AIRecommendation>>(new Map());
  const pendingIndexes = entry.recommendations
    .map((recommendation, index) => {
      const hasLegacyResolvedData =
        entry.verified && typeof recommendation.verifiedTmdbId === "number";
      return recommendation.validationAttempted || hasLegacyResolvedData
        ? null
        : index;
    })
    .filter((index): index is number => index !== null);
  const resolvedCountRef = useRef(0);
  const hasPushedRef = useRef(false);
  const completedRecommendationsRef = useRef<AIRecommendation[] | null>(null);
  const isSavingRef = useRef(false);
  const activeEntryIdRef = useRef(entry.id);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const entryId = entry.id;

  const persistVerified = useCallback(
    async (recommendations: AIRecommendation[]) => {
      if (hasPushedRef.current || isSavingRef.current) return;

      isSavingRef.current = true;
      setIsSaving(true);
      setSaveFailed(false);
      try {
        await updateVerified(entryId, recommendations);
        if (activeEntryIdRef.current === entryId) {
          hasPushedRef.current = true;
          completedRecommendationsRef.current = null;
        }
      } catch {
        if (activeEntryIdRef.current === entryId) setSaveFailed(true);
      } finally {
        if (activeEntryIdRef.current === entryId) {
          isSavingRef.current = false;
          setIsSaving(false);
        }
      }
    },
    [entryId, updateVerified],
  );

  useEffect(() => {
    activeEntryIdRef.current = entryId;
    verifiedMapRef.current = new Map();
    resolvedCountRef.current = 0;
    hasPushedRef.current = false;
    completedRecommendationsRef.current = null;
    isSavingRef.current = false;
    setIsSaving(false);
    setSaveFailed(false);
  }, [entryId]);

  const onCardResolved = useCallback(
    (index: number, verifiedRec: AIRecommendation) => {
      if (!pendingIndexes.includes(index)) return;
      verifiedMapRef.current.set(index, verifiedRec);
      resolvedCountRef.current = verifiedMapRef.current.size;

      if (
        !hasPushedRef.current &&
        pendingIndexes.length > 0 &&
        resolvedCountRef.current >= pendingIndexes.length
      ) {
        const updatedRecs = entry.recommendations.map((rec, i) => {
          const resolved = verifiedMapRef.current.get(i);
          if (!resolved) return rec;
          return { ...resolved, validationAttempted: true };
        });
        completedRecommendationsRef.current = updatedRecs;
        void persistVerified(updatedRecs);
      }
    },
    [entry.recommendations, pendingIndexes, persistVerified],
  );

  return (
    <>
      <MediaGrid stagger>
        {entry.recommendations.map((rec, i) => (
          <RecommendationCard
            key={rec.tmdbId ?? rec.title}
            recommendation={rec}
            isEntryVerified={!!entry.verified}
            onResolved={(verifiedRec) => onCardResolved(i, verifiedRec)}
          />
        ))}
      </MediaGrid>
      {saveFailed && completedRecommendationsRef.current && (
        <div className="text-muted-foreground flex items-center justify-end gap-2 text-xs">
          <span>Could not save validation results.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={isSaving}
            onClick={() => {
              const recommendations = completedRecommendationsRef.current;
              if (recommendations) void persistVerified(recommendations);
            }}
          >
            Retry
          </Button>
        </div>
      )}
    </>
  );
}

function RecommendationCard({
  recommendation,
  isEntryVerified: _isEntryVerified,
  onResolved,
}: {
  recommendation: AIRecommendation;
  isEntryVerified: boolean;
  onResolved?: (verifiedRec: AIRecommendation) => void;
}) {
  const { title, mediaType, relevanceScore, reasoning } = recommendation;
  const navigate = useNavigate();
  const hasReportedRef = useRef(false);

  const hasCachedResolvedData =
    typeof recommendation.verifiedTmdbId === "number" &&
    (recommendation.validationAttempted === true || _isEntryVerified);
  const hasCachedValidation =
    recommendation.validationAttempted === true || hasCachedResolvedData;
  const { resolvedData, isResolving } = useResolvedRecommendation(
    recommendation,
    { enabled: !hasCachedValidation },
  );

  useEffect(() => {
    if (hasCachedValidation || hasReportedRef.current || isResolving) return;
    hasReportedRef.current = true;

    if (resolvedData && onResolved) {
      onResolved({
        ...recommendation,
        verifiedTmdbId: resolvedData.id,
        verifiedTitle: resolvedData.title,
        posterPath: resolvedData.posterPath,
        rating: resolvedData.rating,
        releaseDate: resolvedData.releaseDate,
        overview: resolvedData.overview,
      });
    } else if (onResolved) {
      // Keep unresolved cards in the batch so backend verification can finish.
      onResolved(recommendation);
    }
  }, [
    hasCachedValidation,
    isResolving,
    resolvedData,
    recommendation,
    onResolved,
  ]);

  if (hasCachedResolvedData) {
    return (
      <MediaCard
        card_type="horizontal"
        id={recommendation.verifiedTmdbId as number}
        title={recommendation.verifiedTitle ?? title}
        rating={recommendation.rating ?? 0}
        image={recommendation.posterPath ?? ""}
        poster_path={recommendation.posterPath ?? ""}
        media_type={mediaType}
        release_date={recommendation.releaseDate ?? null}
        overview={recommendation.overview ?? ""}
        relevanceScore={relevanceScore}
      />
    );
  }

  if (isResolving) {
    return <MediaCardSkeleton card_type="horizontal" />;
  }

  if (resolvedData) {
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
        relevanceScore={relevanceScore}
      />
    );
  }

  return (
    <div className="group/card w-40 md:w-44 lg:w-48">
      <Button
        type="button"
        variant="ghost"
        className="bg-muted ring-border/40 hover:bg-muted relative aspect-2/3 h-auto w-full overflow-hidden rounded-xl p-0 text-left ring-1 transition-[box-shadow,border-color] duration-200"
        onClick={() => navigate({ to: "/search", search: { query: title } })}
      >
        <div className="absolute top-0 right-0 left-0 z-10 flex items-start justify-end p-2.5">
          <span className="bg-secondary text-muted-foreground rounded-md px-2 py-1 text-[11px] font-medium capitalize">
            {mediaType === "movie" ? "Movie" : "TV"}
          </span>
        </div>

        <div className="absolute right-0 bottom-0 left-0 z-10 flex flex-col gap-1.5 p-3">
          <h3 className="text-foreground line-clamp-2 text-[15px] leading-snug font-bold">
            {title}
          </h3>
          <p className="text-muted-foreground line-clamp-3 text-[10.5px] leading-relaxed">
            {reasoning}
          </p>
          <div className="mt-1 flex w-full items-center justify-between">
            <span className="text-muted-foreground/50 group-hover/card:text-foreground inline-flex items-center gap-1 text-[10.5px] font-medium transition-colors duration-200">
              <ArrowUpRight size={11} />
              Search
            </span>
            {relevanceScore && (
              <span
                className={cn(
                  "text-[10.5px] font-semibold",
                  relevanceScore >= 80
                    ? "text-emerald-600 dark:text-emerald-400"
                    : relevanceScore >= 60
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground",
                )}
              >
                {relevanceScore}% Match
              </span>
            )}
          </div>
        </div>
      </Button>
    </div>
  );
}
