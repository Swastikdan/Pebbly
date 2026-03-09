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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SECTION_TAB_LIST_CLASS, SECTION_TAB_TRIGGER_CLASS } from "@/constants";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<section className="flex flex-col items-center justify-center">
			<div className="relative w-full overflow-hidden">
				<div className="mx-auto max-w-screen-lg px-4 py-8 pt-6 pb-6 text-center sm:px-6 md:pt-12 md:pb-8 lg:px-8">
					<div className="py-4 animate-fade-in-up">
						<h1 className="items-center justify-center font-black text-2xl tracking-tight sm:text-5xl md:text-[4rem] lg:text-[4.5rem] lg:leading-[1.1]">
							Welcome to
							<span className="px-2 text-blue-500">Film Fanatic</span>
						</h1>
						<p className="mt-2 mb-4 text-xs text-muted-foreground tracking-wide sm:text-sm">
							Millions of movies, TV shows, and people to discover.
						</p>
					</div>

					<div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
						<Suspense fallback={<SearchBarSkeleton />}>
							<SearchBar />
						</Suspense>
					</div>
				</div>
			</div>

			<div className="mx-auto flex w-full max-w-screen-xl px-5 py-6 md:pt-10 md:pb-8">
				<div className="flex w-full flex-col gap-10">
					<Tabs defaultValue="trending_day">
						<div className="flex items-center gap-4">
							<h2 className="font-semibold text-lg md:text-xl">Trending</h2>
							<TabsList className={SECTION_TAB_LIST_CLASS}>
								<TabsTrigger
									value="trending_day"
									className={SECTION_TAB_TRIGGER_CLASS}
								>
									Today
								</TabsTrigger>
								<TabsTrigger
									value="trending_week"
									className={SECTION_TAB_TRIGGER_CLASS}
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
						<div className="flex items-center gap-4">
							<h2 className="font-semibold text-lg md:text-xl">
								Upcoming Movies
							</h2>
						</div>
						<div>
							<UpcomingMovies />
						</div>
					</section>

					<Tabs defaultValue="popular_movie">
						<div className="flex items-center gap-4">
							<h2 className="font-semibold text-lg md:text-xl">{`What's Popular`}</h2>
							<TabsList className={SECTION_TAB_LIST_CLASS}>
								<TabsTrigger
									value="popular_movie"
									className={SECTION_TAB_TRIGGER_CLASS}
								>
									Theaters
								</TabsTrigger>
								<TabsTrigger
									value="popular_tv"
									className={SECTION_TAB_TRIGGER_CLASS}
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
						<div className="flex items-center gap-4">
							<h2 className="font-semibold text-lg md:text-xl">Top Rated</h2>
							<TabsList className={SECTION_TAB_LIST_CLASS}>
								<TabsTrigger
									value="top_rated_movies"
									className={SECTION_TAB_TRIGGER_CLASS}
								>
									Movies
								</TabsTrigger>
								<TabsTrigger
									value="top_rated_tv"
									className={SECTION_TAB_TRIGGER_CLASS}
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
