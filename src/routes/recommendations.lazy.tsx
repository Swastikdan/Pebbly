import type { ReactNode } from "react";
import { useUser } from "@clerk/react";
import { BrainCircuit } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";

import type {
  GenerateOptions,
  RecommendationHistoryEntry,
} from "@/hooks/use-recommendations";
import type { MediaType } from "@/lib/media-types";
import type { AIRecommendation } from "@/lib/recommendation-engine";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import {
  ERA_PRESETS,
  RecommendationFilters,
} from "@/components/recommendations/recommendation-filters";
import { RecommendationHistory } from "@/components/recommendations/recommendation-history";
import { RecommendationResults } from "@/components/recommendations/recommendation-results";
import { usePermissions } from "@/hooks/use-permissions";
import { useRecommendations } from "@/hooks/use-recommendations";
import { useWatchlist } from "@/hooks/use-watchlist";
import { queryKeys } from "@/lib/query/keys";
import { normalizeTitleKey } from "@/lib/text";
import { getCustomLists } from "@/server/fns/lists";
import { getTrackedTmdbIds } from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import { MAX_EXCLUDE_TMDB_IDS } from "@/server/schema/recommendations";

export const Route = createLazyFileRoute("/recommendations")({
  component: RecommendationsPage,
});

function isTrackedRecommendation(
  recommendation: AIRecommendation,
  trackedIds: Set<number>,
  trackedTitles: Set<string>,
) {
  const candidateIds = [
    recommendation.tmdbId,
    recommendation.verifiedTmdbId,
  ].filter((id): id is number => typeof id === "number");
  if (candidateIds.some((id) => trackedIds.has(id))) return true;

  const candidateTitles = [
    recommendation.title,
    recommendation.verifiedTitle,
  ].map(normalizeTitleKey);

  return candidateTitles.some((title) => title && trackedTitles.has(title));
}

function RecommendationsPage() {
  const { hasFeature, loading: accessLoading, isSignedIn } = usePermissions();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (
    isMounted &&
    !accessLoading &&
    (!isSignedIn || !hasFeature("ai-recommendations"))
  ) {
    return <DefaultNotFoundComponent />;
  }

  return (
    <PageShell>
      <RecommendationsContent
        isSignedIn={isSignedIn}
        accessLoading={!isMounted || accessLoading}
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="w-full max-w-7xl p-5">
        <div className="mb-6 flex items-center justify-between gap-3">
          <GoBack title="Back" hideLabelOnMobile />
        </div>
        <h1 className="animate-fade-in-up mb-6 text-start text-2xl font-bold tracking-tight md:text-3xl">
          AI Recommendations
        </h1>
        {children}
      </div>
    </section>
  );
}

const GEN_STAGES = [
  "Reading your library…",
  "Filtering what you've already seen…",
  "Drafting your picks…",
] as const;

function RecommendationsContent({
  isSignedIn,
  accessLoading,
}: {
  isSignedIn: boolean;
  accessLoading: boolean;
}) {
  const {
    history,
    loading: historyLoading,
    isGenerating,
    error,
    generate,
    deleteEntry,
    updateVerified,
  } = useRecommendations();

  const { watchlist, loading: watchlistLoading } = useWatchlist();

  const { user } = useUser();
  const trackedTmdbIdsQuery = useQuery({
    queryKey: queryKeys.watchlist.trackedTmdbIds(user?.id),
    queryFn: () => unwrap(getTrackedTmdbIds()),
    enabled: !!isSignedIn,
  });
  const trackedIdSet = useMemo<Set<number>>(
    () => new Set((trackedTmdbIdsQuery.data ?? []) as number[]),
    [trackedTmdbIdsQuery.data],
  );
  const trackedTitleSet = useMemo(
    () =>
      new Set(
        watchlist.map((item) => normalizeTitleKey(item.title)).filter(Boolean),
      ),
    [watchlist],
  );

  const filteredHistory = useMemo(
    () =>
      watchlistLoading
        ? history
        : history
            .map((entry) => ({
              ...entry,
              recommendations: entry.recommendations.filter(
                (r) =>
                  !isTrackedRecommendation(r, trackedIdSet, trackedTitleSet),
              ),
            }))
            .filter((entry) => entry.recommendations.length > 0),
    [history, trackedIdSet, trackedTitleSet, watchlistLoading],
  );

  const navigate = Route.useNavigate();

  const searchParams = Route.useSearch();
  const activeId = searchParams.activeId || null;

  const setActiveId = useCallback(
    (id: string | null) => {
      navigate({
        search: (prev) => ({ ...prev, activeId: id || undefined }),
        replace: true,
      });
    },
    [navigate],
  );

  useEffect(() => {
    if (!activeId && filteredHistory.length > 0) {
      setActiveId(filteredHistory[0].id);
    }
  }, [activeId, filteredHistory, setActiveId]);

  const [genMode, setGenMode] = useState<"watchlist" | "genre" | "list">(
    "watchlist",
  );
  const [listId, setListId] = useState<string>("");
  const [mediaType, setMediaType] = useState<MediaType | undefined>();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedEras, setSelectedEras] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [genStage, setGenStage] = useState(0);

  // Cycle through the generation narrative; reset whenever generation stops.
  useEffect(() => {
    if (!isGenerating) {
      setGenStage(0);
      return;
    }
    const timer = window.setInterval(() => {
      setGenStage((stage) => Math.min(stage + 1, GEN_STAGES.length - 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const toggleGenre = (name: string) => {
    setSelectedGenres((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
    );
  };

  const toggleEra = (label: string) => {
    setSelectedEras((prev) =>
      prev.includes(label) ? prev.filter((e) => e !== label) : [...prev, label],
    );
  };

  const customListsQuery = useQuery({
    queryKey: queryKeys.lists.all(user?.id),
    queryFn: () => unwrap(getCustomLists()),
    enabled: !!isSignedIn,
  });
  const customLists = customListsQuery.data ?? [];

  const handleGenerate = () => {
    if (genMode === "watchlist" && watchlist.length === 0) return;
    if (genMode === "list" && !listId) return;

    const options: GenerateOptions = { generationType: genMode };
    if (genMode === "list") options.listId = listId;

    if (mediaType) options.mediaTypePreference = mediaType;
    if (genMode === "genre" && selectedGenres.length > 0)
      options.genrePreference = selectedGenres.join(", ");

    if (selectedEras.length > 0) {
      const matchedEras = ERA_PRESETS.filter((e) =>
        selectedEras.includes(e.label),
      );
      options.yearFrom = Math.min(...matchedEras.map((e) => e.from));
      options.yearTo = Math.max(...matchedEras.map((e) => e.to));
    }

    if (trackedIdSet.size > 0) {
      options.excludeTmdbIds = Array.from(trackedIdSet).slice(
        0,
        MAX_EXCLUDE_TMDB_IDS,
      );
    }

    options.count = count;
    generate(options);
    setActiveId(null);
  };

  const handleGenerateAgain = (entry: RecommendationHistoryEntry) => {
    const options: GenerateOptions = {
      generationType: (entry.generationType || "watchlist") as
        "watchlist" | "list" | "genre",
    };
    if (entry.mediaTypePreference)
      options.mediaTypePreference = entry.mediaTypePreference as MediaType;
    if (entry.genrePreference) options.genrePreference = entry.genrePreference;
    if (trackedIdSet.size > 0) {
      options.excludeTmdbIds = Array.from(trackedIdSet).slice(
        0,
        MAX_EXCLUDE_TMDB_IDS,
      );
    }
    options.count = count;
    generate(options);
    setActiveId(null);
  };

  const handleGenerateMore = (entry: RecommendationHistoryEntry) => {
    const options: GenerateOptions = {
      generationType: (entry.generationType || "watchlist") as
        "watchlist" | "list" | "genre",
    };
    if (entry.mediaTypePreference)
      options.mediaTypePreference = entry.mediaTypePreference as MediaType;
    if (entry.genrePreference) options.genrePreference = entry.genrePreference;

    options.excludeTmdbIds = [
      ...new Set([
        ...entry.recommendations
          .flatMap((r) => [r.tmdbId, r.verifiedTmdbId])
          .filter((id): id is number => typeof id === "number"),
        ...Array.from(trackedIdSet),
      ]),
    ].slice(0, MAX_EXCLUDE_TMDB_IDS);

    options.count = count;
    generate(options);
    setActiveId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    if (activeId === id) setActiveId(null);
  };

  const activeEntry =
    (activeId ? filteredHistory.find((h) => h.id === activeId) : null) ??
    filteredHistory[0] ??
    null;

  const errorMessages: Record<string, string> = {
    empty_watchlist:
      "Add some movies or TV shows to your watchlist first to get recommendations.",
    api_unavailable:
      "The AI service is temporarily unavailable. Please try again later.",
    invalid_response:
      "The AI returned an unexpected response. Please try again.",
    rate_limited:
      "Please wait a couple minutes before generating new recommendations.",
    high_demand:
      "The AI model is currently experiencing high demand. Please try again later.",
  };

  return (
    <div className="space-y-8">
      <RecommendationFilters
        genMode={genMode}
        setGenMode={setGenMode}
        listId={listId}
        setListId={setListId}
        mediaType={mediaType}
        setMediaType={setMediaType}
        selectedGenres={selectedGenres}
        toggleGenre={toggleGenre}
        selectedEras={selectedEras}
        toggleEra={toggleEra}
        count={count}
        setCount={setCount}
        showAdvancedOptions={showAdvancedOptions}
        setShowAdvancedOptions={setShowAdvancedOptions}
        customLists={customLists}
        watchlist={watchlist}
        watchlistLoading={watchlistLoading}
        isGenerating={isGenerating}
        handleGenerate={handleGenerate}
      />

      {error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive animate-in fade-in slide-in-from-top-1 rounded-lg border p-4 text-sm">
          {errorMessages[error as string] ?? error}
        </div>
      )}

      {(accessLoading || historyLoading) && !isGenerating && <DefaultLoader />}

      {isGenerating && (
        <div className="animate-in fade-in space-y-4 duration-300">
          <div className="border-border bg-card flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-none">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <BrainCircuit className="size-4 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Building recommendations</p>
              <p
                key={genStage}
                className="text-muted-foreground animate-fade-in text-xs"
              >
                {GEN_STAGES[genStage]}
              </p>
            </div>
          </div>
          {/* Indeterminate progress bar */}
          <div
            className="bg-secondary h-1 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Generating recommendations"
          >
            <div className="progress-indeterminate h-full rounded-full bg-blue-600" />
          </div>
          <DefaultLoader />
        </div>
      )}

      {!accessLoading && !historyLoading && !isGenerating && activeEntry && (
        <RecommendationResults
          entry={activeEntry}
          updateVerified={updateVerified}
        />
      )}

      {!accessLoading &&
        !historyLoading &&
        !isGenerating &&
        filteredHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <BrainCircuit className="text-muted-foreground/40 size-10" />
            <p className="text-muted-foreground max-w-sm text-center text-sm">
              Generate your first recommendations using your watchlist or by
              selecting genres above.
            </p>
          </div>
        )}

      {filteredHistory.length > 0 && (
        <RecommendationHistory
          entries={filteredHistory}
          activeEntryId={activeEntry?.id ?? null}
          isGenerating={isGenerating}
          onSelect={setActiveId}
          onDelete={handleDelete}
          onGenerateAgain={handleGenerateAgain}
          onGenerateMore={handleGenerateMore}
        />
      )}
    </div>
  );
}
