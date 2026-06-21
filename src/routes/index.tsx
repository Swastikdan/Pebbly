import { useUser } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
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
import { SearchBar, SearchBarSkeleton } from "@/components/ui/search-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	SECTION_TAB_LIST_CLASS,
	SECTION_TAB_TRIGGER_CLASS,
	SITE_CONFIG,
} from "@/constants";
import { useContinueWatching } from "@/hooks/useWatchProgress";

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

function Deferred({ children }: { children: React.ReactNode }) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		const t = setTimeout(() => setMounted(true), 50);
		return () => clearTimeout(t);
	}, []);
	return mounted ? children : <div className="min-h-[300px]" />;
}

function HomePage() {
	return (
		<section className="flex flex-col items-center justify-center">
			<div className="relative w-full overflow-hidden">
				<div className="mx-auto max-w-screen-lg px-4 py-8 pt-6 pb-6 text-center sm:px-6 md:pt-12 md:pb-8 lg:px-8">
					<div className="py-4 animate-fade-in-up">
						<h1 className="items-center justify-center text-display">
							Welcome to
							<span className="px-2 text-blue-500">{SITE_CONFIG.name}</span>
						</h1>
						<p className="mt-2 mb-4 text-body text-muted-foreground">
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
							<h2 className="text-h2">Trending</h2>
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

					<ContinueWatchingSection />

					<HomepageRecommendations />

					<section
						className="content-visibility-auto"
						style={{ containIntrinsicHeight: "auto 280px" }}
					>
						<div className="flex items-center gap-4">
							<h2 className="text-h2">Upcoming Movies</h2>
						</div>
						<div>
							<Deferred>
								<UpcomingMovies />
							</Deferred>
						</div>
					</section>

					<Tabs
						defaultValue="popular_movie"
						className="content-visibility-auto"
						style={{ containIntrinsicHeight: "auto 360px" }}
					>
						<div className="flex items-center gap-4">
							<h2 className="text-h2">{`What's Popular`}</h2>
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
							<Deferred>
								<PopularMovies />
							</Deferred>
						</TabsContent>
						<TabsContent value="popular_tv">
							<Deferred>
								<PopularTv />
							</Deferred>
						</TabsContent>
					</Tabs>

					<Tabs
						defaultValue="top_rated_movies"
						className="content-visibility-auto"
						style={{ containIntrinsicHeight: "auto 360px" }}
					>
						<div className="flex items-center gap-4">
							<h2 className="text-h2">Top Rated</h2>
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
							<Deferred>
								<TopRatedMovies />
							</Deferred>
						</TabsContent>
						<TabsContent value="top_rated_tv">
							<Deferred>
								<TopRatedTv />
							</Deferred>
						</TabsContent>
					</Tabs>
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
			<div className="flex items-center gap-4">
				<h2 className="text-h2">Continue Watching</h2>
			</div>
			<div>
				<Deferred>
					<ContinueWatching />
				</Deferred>
			</div>
		</section>
	);
}
