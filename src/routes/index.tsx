import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import {
	PopularMovies,
	PopularTv,
	TopRatedMovies,
	TopRatedTv,
	TrendingDayMovies,
	TrendingWeekMovies,
	UpcomingMovies,
} from "@/components/homepage-media";
import { SearchBar, SearchBarSkeleton } from "@/components/ui/search-bar";
import { TAB_LIST_CLASSNAME, TAB_TRIGGER_CLASSNAME } from "@/lib/tab-styles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<section className="flex flex-col items-center justify-center">
			<div className="before:-z-[1] before:-translate-x-1/2 before:-translate-y-1/2 relative w-full overflow-hidden before:absolute before:start-1/2 before:top-1/2 before:h-96 before:w-full before:transform before:bg-[url('https://preline.co/assets/svg/component/hyperdrive.svg')] before:bg-center before:bg-no-repeat dark:before:bg-[url('https://preline.co/assets/svg/component-dark/hyperdrive.svg')]">
				<div className="mx-auto max-w-screen-lg px-4 py-10 pt-5 pb-5 text-center sm:px-6 md:pt-10 lg:px-8 lg:py-14">
					<div className="py-5">
						<h1 className="items-center justify-center font-black text-2xl sm:text-5xl md:text-[4rem] lg:text-[5rem] lg:leading-tight">
							Welcome to
							<span className="px-2 text-blue-500">Film Fanatic</span>
						</h1>
						<p className="mb-3 text-[10px] text-accent-foreground tracking-wide sm:text-xs">
							Millions of movies, TV shows, and people to discover.
						</p>
					</div>

					<Suspense fallback={<SearchBarSkeleton />}>
						<SearchBar />
					</Suspense>
				</div>
			</div>

			<div className="mx-auto flex w-full max-w-screen-xl px-5 py-5 pt-5 pb-5 md:pt-10">
				<div className="flex w-full flex-col gap-10">
					<Tabs defaultValue="trending_day">
						<div className="flex items-center gap-5">
							<h2 className="font-medium text-xl md:text-2xl">Trending</h2>
							<TabsList className={TAB_LIST_CLASSNAME}>
								<TabsTrigger
									value="trending_day"
									className={TAB_TRIGGER_CLASSNAME}
								>
									Today
								</TabsTrigger>
								<TabsTrigger
									value="trending_week"
									className={TAB_TRIGGER_CLASSNAME}
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
							<h2 className="font-medium text-xl md:text-2xl">
								Upcoming Movies
							</h2>
						</div>
						<div>
							<UpcomingMovies />
						</div>
					</section>

					<Tabs defaultValue="popular_movie">
						<div className="flex items-center gap-5">
							<h2 className="font-medium text-xl md:text-2xl">{`What's Popular`}</h2>
							<TabsList className={TAB_LIST_CLASSNAME}>
								<TabsTrigger
									value="popular_movie"
									className={TAB_TRIGGER_CLASSNAME}
								>
									Theaters
								</TabsTrigger>
								<TabsTrigger
									value="popular_tv"
									className={TAB_TRIGGER_CLASSNAME}
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
							<h2 className="font-medium text-xl md:text-2xl">Top Rated</h2>
							<TabsList className={TAB_LIST_CLASSNAME}>
								<TabsTrigger
									value="top_rated_movies"
									className={TAB_TRIGGER_CLASSNAME}
								>
									Movies
								</TabsTrigger>
								<TabsTrigger
									value="top_rated_tv"
									className={TAB_TRIGGER_CLASSNAME}
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
		</section>
	);
}
