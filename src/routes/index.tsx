import { useUser } from "@clerk/react";
import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { COMMAND_PALETTE_OPEN_EVENT } from "@/components/command-palette";
import { DailyPickButton } from "@/components/daily-pick";
import { TrendingDayMovies } from "@/components/homepage-media";
import { MediaSkeletonList } from "@/components/media-skeleton-list";
import { LazySection } from "@/components/ui/lazy-section";
import { SearchBar, SearchBarSkeleton } from "@/components/ui/search-bar";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { IMAGE_PREFIX, SITE_CONFIG } from "@/constants";
import { usePermissions } from "@/hooks/use-permissions";
import { useContinueWatching } from "@/hooks/watch-progress/use-watch-progress";
import { getMedia } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { tmdbSrcSet } from "@/lib/tmdb-image";

// Below-fold homepage rails are the largest contributors to the 96 KiB
// unused JS in `DmBDMIEq.js` (Pagespeed desktop). They are not needed for
// LCP (only TrendingDayMovies is above the fold with priority images).
// Lazy-load them so their JS (MediaCard, query hooks, recommendation
// logic) is split into separate chunks and only fetched when the
// `LazySection` intersects or the tab becomes active. This cuts script
// evaluation (806ms) and the 143 KiB 1st-party unused JS.
const HomepageRecommendations = lazy(() =>
  import("@/components/homepage-recommendations").then((m) => ({
    default: m.HomepageRecommendations,
  })),
);
const TrendingWeekMovies = lazy(() =>
  import("@/components/homepage-media").then((m) => ({
    default: m.TrendingWeekMovies,
  })),
);
const UpcomingMovies = lazy(() =>
  import("@/components/homepage-media").then((m) => ({
    default: m.UpcomingMovies,
  })),
);
const PopularMovies = lazy(() =>
  import("@/components/homepage-media").then((m) => ({
    default: m.PopularMovies,
  })),
);
const PopularTv = lazy(() =>
  import("@/components/homepage-media").then((m) => ({
    default: m.PopularTv,
  })),
);
const TopRatedMovies = lazy(() =>
  import("@/components/homepage-media").then((m) => ({
    default: m.TopRatedMovies,
  })),
);
const TopRatedTv = lazy(() =>
  import("@/components/homepage-media").then((m) => ({
    default: m.TopRatedTv,
  })),
);
const ContinueWatching = lazy(() =>
  import("@/components/homepage-media").then((m) => ({
    default: m.ContinueWatching,
  })),
);

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.tmdb.trendingDay(),
      queryFn: () => getMedia({ type: "trending_day" }),
    });
    // Return the first 2 poster paths for LCP preload in `head`. These are
    // the `priorityCount={2}` cards in TrendingDayMovies – the only
    // above-the-fold images with `loading="eager"` + `fetchPriority="high"`.
    // Preloading with `imagesrcset`/`imagesizes` cuts `resourceLoadDelay`
    // (780ms in Pagespeed) by hinting the browser before the body is parsed.
    const lcpPosters = data
      .slice(0, 2)
      .map((m) => m.poster_path)
      .filter(Boolean) as string[];
    return { lcpPosters };
  },
  head: ({ loaderData }) => {
    const posters = (loaderData as { lcpPosters?: string[] } | undefined)
      ?.lcpPosters;
    if (!posters?.length) return {};
    const links = posters.map((path) => {
      const src = `${IMAGE_PREFIX.LQ_POSTER}${path}`;
      const srcSet = tmdbSrcSet(src);
      return {
        rel: "preload" as const,
        as: "image" as const,
        imageSrcSet: srcSet,
        imageSizes: "(max-width: 640px) 160px, (max-width: 768px) 176px, 192px",
        href: src,
        fetchPriority: "high" as const,
      };
    });
    return { links };
  },
  component: HomePage,
});

function HomePage() {
  const openCommandPalette = () => {
    window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
  };

  return (
    <section className="flex flex-col items-center justify-center">
      <div className="relative w-full overflow-hidden">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 md:py-16 lg:px-8">
          <div className="motion-safe:animate-fade-in-up py-4">
            <h1 className="text-display items-center justify-center">
              Welcome to
              <span className="px-2 text-blue-500">{SITE_CONFIG.name}</span>
            </h1>
            <p className="text-body text-muted-foreground mt-2 mb-4">
              Millions of movies, TV shows, and people to discover.
            </p>
          </div>

          <div
            className="motion-safe:animate-fade-in"
            style={{ animationDelay: "150ms" }}
          >
            <Suspense fallback={<SearchBarSkeleton />}>
              <SearchBar onCommandOpen={openCommandPalette} />
            </Suspense>
          </div>

          <div
            className="motion-safe:animate-fade-in mt-4 flex justify-center"
            style={{ animationDelay: "250ms" }}
          >
            <DailyPickButton />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl px-5 py-6 md:pt-10 md:pb-8">
        <div className="flex w-full flex-col gap-10">
          <Tabs defaultValue="trending_day">
            <div className="mt-2 flex items-center gap-4">
              <h2 className="text-h2">Trending</h2>
              <TabsList>
                <TabsTab value="trending_day">Today</TabsTab>
                <TabsTab value="trending_week">This Week</TabsTab>
              </TabsList>
            </div>
            <TabsPanel value="trending_day">
              <Suspense
                fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
              >
                <TrendingDayMovies />
              </Suspense>
            </TabsPanel>
            <TabsPanel value="trending_week">
              <Suspense
                fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
              >
                <TrendingWeekMovies />
              </Suspense>
            </TabsPanel>
          </Tabs>

          <ContinueWatchingSection />

          <RecommendationsSection />

          <div className="mt-2 flex items-center gap-4">
            <h2 className="text-h2">Upcoming Movies</h2>
          </div>
          <LazySection
            minHeight="280px"
            className="content-visibility-auto"
            fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
          >
            <Suspense
              fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
            >
              <UpcomingMovies />
            </Suspense>
          </LazySection>

          <LazySection
            minHeight="360px"
            className="content-visibility-auto"
            fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
          >
            <Tabs defaultValue="popular_movie">
              <div className="flex items-center gap-4">
                <h2 className="text-h2">Most Popular</h2>
                <TabsList>
                  <TabsTab value="popular_movie">Theaters</TabsTab>
                  <TabsTab value="popular_tv">On TV</TabsTab>
                </TabsList>
              </div>
              <TabsPanel value="popular_movie">
                <Suspense
                  fallback={
                    <MediaSkeletonList cardType="horizontal" count={6} />
                  }
                >
                  <PopularMovies />
                </Suspense>
              </TabsPanel>
              <TabsPanel value="popular_tv">
                <Suspense
                  fallback={
                    <MediaSkeletonList cardType="horizontal" count={6} />
                  }
                >
                  <PopularTv />
                </Suspense>
              </TabsPanel>
            </Tabs>
          </LazySection>

          <LazySection
            minHeight="360px"
            className="content-visibility-auto"
            fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
          >
            <Tabs defaultValue="top_rated_movies">
              <div className="flex items-center gap-4">
                <h2 className="text-h2">Top Rated</h2>
                <TabsList>
                  <TabsTab value="top_rated_movies">Movies</TabsTab>
                  <TabsTab value="top_rated_tv">TV Shows</TabsTab>
                </TabsList>
              </div>
              <TabsPanel value="top_rated_movies">
                <Suspense
                  fallback={
                    <MediaSkeletonList cardType="horizontal" count={6} />
                  }
                >
                  <TopRatedMovies />
                </Suspense>
              </TabsPanel>
              <TabsPanel value="top_rated_tv">
                <Suspense
                  fallback={
                    <MediaSkeletonList cardType="horizontal" count={6} />
                  }
                >
                  <TopRatedTv />
                </Suspense>
              </TabsPanel>
            </Tabs>
          </LazySection>
        </div>
      </div>
    </section>
  );
}

function ContinueWatchingSection() {
  const { isSignedIn, isLoaded } = useUser();
  const { items, isLoading, isSettled } = useContinueWatching();

  // Do not reserve a placeholder for signed-out visitors. Continue Watching
  // is a private, user-specific rail and should not leave an empty gap.
  if (!isLoaded || !isSignedIn) return null;

  if (isLoading || !isSettled) {
    return (
      <section aria-hidden="true" className="min-h-80">
        <div className="mt-2 flex items-center gap-4">
          <h2 className="text-h2">Continue Watching</h2>
        </div>
        <div>
          <MediaSkeletonList cardType="vertical" count={6} />
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="min-h-80">
      <div className="mt-2 flex items-center gap-4">
        <h2 className="text-h2">Continue Watching</h2>
      </div>
      <div>
        <LazySection
          minHeight="280px"
          fallback={<MediaSkeletonList cardType="vertical" count={6} />}
        >
          <Suspense
            fallback={<MediaSkeletonList cardType="vertical" count={6} />}
          >
            <ContinueWatching />
          </Suspense>
        </LazySection>
      </div>
    </section>
  );
}

function RecommendationsSection() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { hasFeature } = usePermissions();

  // Do not reserve a placeholder for signed-out visitors. During Clerk's
  // logout transition, isSignedIn and user can update in separate renders;
  // requiring both prevents the LazySection from leaving a 300px gap.
  if (!isLoaded || !isSignedIn || !user || !hasFeature("ai-recommendations")) {
    return null;
  }

  return (
    <LazySection
      key={user.id}
      minHeight="300px"
      fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
    >
      <Suspense
        fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
      >
        <HomepageRecommendations />
      </Suspense>
    </LazySection>
  );
}
