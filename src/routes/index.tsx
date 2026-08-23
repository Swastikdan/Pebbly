import { useUser } from "@clerk/react";
import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { DailyPickButton } from "@/components/daily-pick";
import {
  ContinueWatching,
  PopularMovies,
  PopularTv,
  TopRatedMovies,
  TopRatedTv,
  TrendingDayMovies,
  TrendingWeekMovies,
  UpcomingMovies,
} from "@/components/homepage-media";
import { HomepageRecommendations } from "@/components/homepage-recommendations";
import { LazySection } from "@/components/ui/lazy-section";
import { MediaSkeletonList } from "@/components/ui/media-skeleton-list";
import { SearchBar, SearchBarSkeleton } from "@/components/ui/search-bar";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { SITE_CONFIG } from "@/constants";
import { useContinueWatching } from "@/hooks/watch-progress/use-watch-progress";
import { getMedia } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: queryKeys.tmdb.trendingDay(),
      queryFn: () => getMedia({ type: "trending_day" }),
    });
  },
  component: HomePage,
});

function HomePage() {
  return (
    <section className="flex flex-col items-center justify-center">
      <div className="relative w-full overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 py-8 pt-6 pb-6 text-center sm:px-6 md:pt-12 md:pb-8 lg:px-8">
          <div className="animate-fade-in-up py-4">
            <h1 className="text-display items-center justify-center">
              Welcome to
              <span className="px-2 text-blue-500">{SITE_CONFIG.name}</span>
            </h1>
            <p className="text-body text-muted-foreground mt-2 mb-4">
              Millions of movies, TV shows, and people to discover.
            </p>
          </div>

          <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
            <Suspense fallback={<SearchBarSkeleton />}>
              <SearchBar />
            </Suspense>
          </div>

          <div
            className="animate-fade-in mt-4 flex justify-center"
            style={{ animationDelay: "250ms" }}
          >
            <DailyPickButton />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-screen-xl px-5 py-6 md:pt-10 md:pb-8">
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
              <TrendingDayMovies />
            </TabsPanel>
            <TabsPanel value="trending_week">
              <TrendingWeekMovies />
            </TabsPanel>
          </Tabs>

          <ContinueWatchingSection />

          <LazySection
            minHeight="300px"
            fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
          >
            <HomepageRecommendations />
          </LazySection>

          <div className="mt-2 flex items-center gap-4">
            <h2 className="text-h2">Upcoming Movies</h2>
          </div>
          <LazySection
            minHeight="280px"
            className="content-visibility-auto"
            fallback={<MediaSkeletonList cardType="vertical" count={6} />}
          >
            <div>
              <UpcomingMovies />
            </div>
          </LazySection>

          <h2 className="text-h2 mt-2">{`What's Popular`}</h2>
          <LazySection
            minHeight="360px"
            className="content-visibility-auto"
            fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
          >
            <Tabs defaultValue="popular_movie">
              <div className="flex items-center gap-4">
                <TabsList>
                  <TabsTab value="popular_movie">Theaters</TabsTab>
                  <TabsTab value="popular_tv">On TV</TabsTab>
                </TabsList>
              </div>
              <TabsPanel value="popular_movie">
                <PopularMovies />
              </TabsPanel>
              <TabsPanel value="popular_tv">
                <PopularTv />
              </TabsPanel>
            </Tabs>
          </LazySection>

          <h2 className="text-h2 mt-2">Top Rated</h2>
          <LazySection
            minHeight="360px"
            className="content-visibility-auto"
            fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
          >
            <Tabs defaultValue="top_rated_movies">
              <div className="flex items-center gap-4">
                <TabsList>
                  <TabsTab value="top_rated_movies">Movies</TabsTab>
                  <TabsTab value="top_rated_tv">TV Shows</TabsTab>
                </TabsList>
              </div>
              <TabsPanel value="top_rated_movies">
                <TopRatedMovies />
              </TabsPanel>
              <TabsPanel value="top_rated_tv">
                <TopRatedTv />
              </TabsPanel>
            </Tabs>
          </LazySection>
        </div>
      </div>
    </section>
  );
}

function ContinueWatchingSection() {
  const { isSignedIn } = useUser();
  const { items } = useContinueWatching();

  if (!isSignedIn || items.length === 0) return null;

  return (
    <section>
      <div className="mt-2 flex items-center gap-4">
        <h2 className="text-h2">Continue Watching</h2>
      </div>
      <div>
        <LazySection
          minHeight="280px"
          fallback={<MediaSkeletonList cardType="vertical" count={6} />}
        >
          <ContinueWatching />
        </LazySection>
      </div>
    </section>
  );
}
