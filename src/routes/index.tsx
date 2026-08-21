import { useUser } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DailyPickButton } from "@/components/daily-pick";
import {
	ContinueWatching,
	MediaSkeletonList,
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
import { SearchBar, SearchBarSkeleton } from "@/components/ui/search-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SITE_CONFIG } from "@/constants";
import { useContinueWatching } from "@/hooks/watch-progress/use-watch-progress";

import { getMedia } from "@/lib/queries";

export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: ["trending_day"],
			queryFn: () => getMedia({ type: "trending_day" }),
		});
	},
	component: HomePage,
});

function HomePage() {
	return (
		<section className="flex flex-col items-center justify-center">
			<div className="relative w-full overflow-hidden">
				<div
					className="hero-mesh pointer-events-none absolute inset-0"
					aria-hidden="true"
				/>
				<div className="relative mx-auto max-w-5xl px-4 py-8 pt-8 pb-8 text-center sm:px-6 md:pt-14 md:pb-10 lg:px-8">
					<div className="animate-fade-in-up">
						<h1 className="text-display">
							Welcome to
							<span className="px-2 text-primary">{SITE_CONFIG.name}</span>
						</h1>
						<p className="mx-auto mt-2 mb-6 max-w-xl text-body text-muted-foreground">
							Millions of movies, TV shows, and people to discover.
						</p>
					</div>

					<div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
						<Suspense fallback={<SearchBarSkeleton />}>
							<SearchBar />
						</Suspense>
					</div>

					<div
						className="mt-4 flex justify-center animate-fade-in"
						style={{ animationDelay: "250ms" }}
					>
						<DailyPickButton />
					</div>
				</div>
			</div>

			<div className="mx-auto flex w-full max-w-screen-xl px-5 py-6 md:pt-10 md:pb-8">
				<div className="flex w-full flex-col gap-12">
					<Tabs defaultValue="trending_day">
						<div className="flex flex-wrap items-end justify-between gap-3 mt-2">
							<div>
								<p className="eyebrow-label">On the marquee</p>
								<h2 className="text-h2 mt-1.5">Trending</h2>
							</div>
							<TabsList>
								<TabsTrigger value="trending_day">Today</TabsTrigger>
								<TabsTrigger value="trending_week">This Week</TabsTrigger>
							</TabsList>
						</div>
						<TabsContent value="trending_day">
							<TrendingDayMovies />
						</TabsContent>
						<TabsContent value="trending_week">
							<TrendingWeekMovies />
						</TabsContent>
					</Tabs>

					<ContinueWatchingSection />

					<LazySection
						minHeight="300px"
						fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
					>
						<HomepageRecommendations />
					</LazySection>

					<div>
						<p className="eyebrow-label">Coming soon</p>
						<h2 className="text-h2 mt-1.5">Upcoming Movies</h2>
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

					<div>
						<p className="eyebrow-label">In the spotlight</p>
						<h2 className="text-h2 mt-1.5">{`What's Popular`}</h2>
					</div>
					<LazySection
						minHeight="360px"
						className="content-visibility-auto"
						fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
					>
						<Tabs defaultValue="popular_movie">
							<div className="flex items-center gap-4">
								<TabsList>
									<TabsTrigger value="popular_movie">Theaters</TabsTrigger>
									<TabsTrigger value="popular_tv">On TV</TabsTrigger>
								</TabsList>
							</div>
							<TabsContent value="popular_movie">
								<PopularMovies />
							</TabsContent>
							<TabsContent value="popular_tv">
								<PopularTv />
							</TabsContent>
						</Tabs>
					</LazySection>

					<div>
						<p className="eyebrow-label">Hall of fame</p>
						<h2 className="text-h2 mt-1.5">Top Rated</h2>
					</div>
					<LazySection
						minHeight="360px"
						className="content-visibility-auto"
						fallback={<MediaSkeletonList cardType="horizontal" count={6} />}
					>
						<Tabs defaultValue="top_rated_movies">
							<div className="flex items-center gap-4">
								<TabsList>
									<TabsTrigger value="top_rated_movies">Movies</TabsTrigger>
									<TabsTrigger value="top_rated_tv">TV Shows</TabsTrigger>
								</TabsList>
							</div>
							<TabsContent value="top_rated_movies">
								<TopRatedMovies />
							</TabsContent>
							<TabsContent value="top_rated_tv">
								<TopRatedTv />
							</TabsContent>
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
			<div className="flex items-center gap-4 mt-2">
				<div>
					<p className="eyebrow-label">Pick up where you left off</p>
					<h2 className="text-h2 mt-1.5">Continue Watching</h2>
				</div>
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
