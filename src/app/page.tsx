import {
  TrendingDayMovies,
  TrendingWeekMovies,
  UpcomingMovies,
  PopularMovies,
  PopularTv,
  TopRatedMovies,
  TopRatedTv,
} from "@/components/homepage-media-list-section";
import { Searchbar, SearchBarSkeleton } from "@/components/search-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Suspense } from "react";
export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center">
      <div className="relative w-full overflow-hidden before:absolute before:start-1/2 before:top-1/2 before:-z-[1] before:h-96 before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:transform before:bg-[url('https://preline.co/assets/svg/component/hyperdrive.svg')] before:bg-center before:bg-no-repeat dark:before:bg-[url('https://preline.co/assets/svg/component-dark/hyperdrive.svg')]">
        <div className="mx-auto max-w-screen-lg px-4 py-10 pt-5 pb-5 text-center sm:px-6 md:pt-10 lg:px-8 lg:py-14">
          <div className="py-5">
            <h1 className="items-center justify-center text-2xl font-black sm:text-4xl md:text-6xl lg:text-7xl lg:leading-tight">
              Welcome to
              <span className="px-2 text-blue-500">Film Fanatic</span>
            </h1>
            <p className="text-accent-foreground mb-3 text-[10px] tracking-wide sm:text-xs">
              Millions of movies, TV shows, and people to discover.
            </p>
          </div>

          <Suspense fallback={<SearchBarSkeleton />}>
            <Searchbar />
          </Suspense>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-screen-xl px-5 py-5 pt-5 pb-5 md:pt-10">
        <div className="flex w-full flex-col gap-10">
          <Tabs defaultValue="trending_day">
            <div className="flex items-center gap-5">
              <h2 className="text-xl font-medium md:text-2xl">Trending</h2>
              <TabsList className="bg-transparent">
                <TabsTrigger
                  value="trending_day"
                  className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary h-8 px-5 data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:shadow-none"
                >
                  Today
                </TabsTrigger>
                <TabsTrigger
                  value="trending_week"
                  className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary h-8 px-5 data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:shadow-none"
                >
                  This Week
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="trending_day">
              <TrendingDayMovies />
            </TabsContent>
            <TabsContent value="trending_week">
              <TrendingWeekMovies />
            </TabsContent>
          </Tabs>

          <section>
            <div className="flex items-center gap-5">
              <h2 className="text-xl font-medium md:text-2xl">
                Upcoming Movies
              </h2>
            </div>
            <div>
              <UpcomingMovies />
            </div>
          </section>

          <Tabs defaultValue="popular_movie">
            <div className="flex items-center gap-5">
              <h2 className="text-xl font-medium md:text-2xl">{`What's Popular`}</h2>
              <TabsList className="bg-transparent">
                <TabsTrigger
                  value="popular_movie"
                  className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary h-8 px-5 data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:shadow-none"
                >
                  Theaters
                </TabsTrigger>
                <TabsTrigger
                  value="popular_tv"
                  className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary h-8 px-5 data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:shadow-none"
                >
                  On TV
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="popular_movie">
              <PopularMovies />
            </TabsContent>
            <TabsContent value="popular_tv">
              <PopularTv />
            </TabsContent>
          </Tabs>
          <Tabs defaultValue="top_rated_movies">
            <div className="flex items-center gap-5">
              <h2 className="text-xl font-medium md:text-2xl">Top Rated</h2>
              <TabsList className="bg-transparent">
                <TabsTrigger
                  value="top_rated_movies"
                  className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary h-8 px-5 data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:shadow-none"
                >
                  Movies
                </TabsTrigger>
                <TabsTrigger
                  value="top_rated_tv"
                  className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary h-8 px-5 data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:shadow-none"
                >
                  TV Shows
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="top_rated_movies">
              <TopRatedMovies />
            </TabsContent>
            <TabsContent value="top_rated_tv">
              <TopRatedTv />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <div>
        <div className="h-20"></div>
      </div>
    </section>
  );
}
