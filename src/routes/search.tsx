import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { number, object, optional, string } from "valibot";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { SearchBar } from "@/components/ui/search-bar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_PAGINATION_LIMIT } from "@/constants";
import { getMedia, getSearchResult } from "@/lib/queries";
import type { MediaType, SearchResultsEntity } from "@/types";

type FilterType = MediaType | null;

const searchPageSearchSchema = object({
	page: optional(number()),
	query: optional(string()),
});

export const Route = createFileRoute("/search")({
	validateSearch: searchPageSearchSchema,
	head: () => ({
		meta: [
			{ title: "Search Results | Film Fanatic" },
			{
				name: "description",
				content: "Search for movies and TV shows",
			},
		],
	}),
	component: SearchPage,
});

function SearchPage() {
	const navigate = useNavigate();
	const { page: pageNumber, query: searchQuery } = useSearch({
		from: "/search",
	});

	const query = searchQuery ?? "";
	const [page, setPage] = useState(pageNumber ?? 1);
	const [type, setType] = useState<FilterType>(null);
	const [isPending, setIsPending] = useState(false);
	const [minRating, setMinRating] = useState("0");

	const { data, error, isFetching, isLoading } = useQuery({
		queryKey: ["search", query, page],
		queryFn: () => getSearchResult(query, page),
		enabled: !!query,
		staleTime: 1000 * 60 * 60 * 24,
		gcTime: 1000 * 60 * 60 * 24,
		retry: 2,
		refetchOnWindowFocus: false,
	});

	const { data: trendingData, isLoading: isTrendingLoading } = useQuery({
		queryKey: ["trending"],
		queryFn: () => getMedia({ type: "trending_day", page: 1 }),
		staleTime: 1000 * 60 * 60 * 24,
		gcTime: 1000 * 60 * 60 * 24,
		retry: 2,
		refetchOnWindowFocus: false,
		enabled: !query,
	});

	// Sync local page state with URL parameter
	useEffect(() => {
		const urlPage = pageNumber ?? 1;
		if (page !== urlPage) {
			setPage(urlPage);
		}
		setIsPending(false);
	}, [pageNumber, page]);

	const filteredData = useMemo(() => {
		if (!data?.results) return [];

		return data.results.filter((item: SearchResultsEntity) => {
			if (item.media_type === "person") return false;
			if (type && item.media_type !== type) return false;
			const ratingMin = Number(minRating);
			if (ratingMin > 0 && (item.vote_average ?? 0) < ratingMin) return false;
			return true;
		});
	}, [data?.results, type, minRating]);

	// Reset filter if no results for current type
	useEffect(() => {
		if (type && filteredData.length === 0 && data?.results?.length) {
			setType(null);
		}
	}, [filteredData.length, type, data?.results?.length]);

	const handlePageChange = useCallback(
		(newPage: number) => {
			const totalPages = Math.min(data?.total_pages ?? 0, MAX_PAGINATION_LIMIT);

			if (!data || newPage < 1 || newPage > totalPages || newPage === page) {
				return;
			}

			setIsPending(true);
			navigate({
				to: "/search",
				search: {
					query,
					page: newPage,
				},
			});
		},
		[data, page, navigate, query],
	);

	const handleTypeChange = useCallback((newType: FilterType) => {
		setType((prevType) => (prevType === newType ? prevType : newType));
	}, []);

	const handleAllClick = useCallback(
		() => handleTypeChange(null),
		[handleTypeChange],
	);
	const handleMovieClick = useCallback(
		() => handleTypeChange("movie"),
		[handleTypeChange],
	);
	const handleTVClick = useCallback(
		() => handleTypeChange("tv"),
		[handleTypeChange],
	);

	const hasResults = !!data?.results?.length;
	const totalPages = Math.min(data?.total_pages ?? 0, MAX_PAGINATION_LIMIT);
	const showPagination = hasResults && totalPages > 1;
	const isLoadingState = isLoading || isPending || isFetching;

	if (!query) {
		return (
			<section className="flex w-full justify-center">
				<div className="mx-auto w-full max-w-screen-xl p-5">
					<SearchBar query={query} updateUrlOnChange />
					<div className="flex flex-col gap-5 py-5">
						<h2 className="text-xl font-bold">Trending Now</h2>
						{isTrendingLoading ? (
							<div className="grid w-full grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								{Array.from({ length: 12 }).map((_, index) => (
									<MediaCardSkeleton key={index} card_type="horizontal" />
								))}
							</div>
						) : (
							<div className="stagger-grid grid w-full grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								{trendingData?.map((item) => (
									<MediaCard
										key={item.id}
										id={item.id}
										image={item.poster_path ?? ""}
										known_for_department=""
										media_type={item.media_type as MediaType}
										poster_path={item.poster_path ?? ""}
										rating={item.vote_average ?? 0}
										release_date={
											item.first_air_date ?? item.release_date ?? null
										}
										title={item.title ?? item.name ?? "Untitled"}
										overview={item.overview ?? undefined}
										card_type="horizontal"
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</section>
		);
	}

	if (isLoadingState) {
		return (
			<section className="flex w-full justify-center">
				<div className="mx-auto w-full max-w-screen-xl p-5">
					<SearchBar query={query} updateUrlOnChange />
					<div className="flex h-full flex-col gap-5 py-5">
						<div className="flex flex-wrap items-center gap-3">
							<div className="flex gap-1 rounded-lg bg-secondary/30 p-1">
								<Skeleton className="h-7 w-12 rounded-md" />
								<Skeleton className="h-7 w-20 rounded-md" />
								<Skeleton className="h-7 w-20 rounded-md" />
							</div>

							{/* Rating Filter Skeleton */}
							<Skeleton className="h-7 w-[100px] rounded-lg" />

							<Skeleton className="ml-auto h-3 w-[84px] rounded" />
						</div>
						<div className="flex min-h-96 w-full items-center justify-center">
							<div className="grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								{Array.from({ length: 12 }).map((_, index) => (
									<MediaCardSkeleton key={index} card_type="horizontal" />
								))}
							</div>
						</div>
					</div>
				</div>
			</section>
		);
	}

	// Early return for error state
	if (error) {
		return (
			<section className="flex w-full justify-center">
				<div className="mx-auto w-full max-w-screen-xl p-5">
					<SearchBar query={query} updateUrlOnChange />
					<DefaultEmptyState
						onReset={() => {
							navigate({
								to: "/search",
								search: {
									query: undefined,
									page: undefined,
								},
							});
						}}
						message="Something went wrong. Please try again later"
					/>
				</div>
			</section>
		);
	}

	// Early return for no results
	if (filteredData.length === 0) {
		return (
			<section className="flex w-full justify-center">
				<div className="mx-auto w-full max-w-screen-xl p-5">
					<SearchBar query={query} updateUrlOnChange />
					<DefaultEmptyState
						onReset={() => {
							if (hasResults) {
								setType(null);
								setMinRating("0");
							} else {
								navigate({ to: "/search" });
							}
						}}
						message={
							hasResults
								? "No movies or TV shows found with the selected filter"
								: "No movies or TV shows found matching your search"
						}
					/>
					<Pagination
						currentPage={page}
						totalPages={totalPages}
						onPageChange={handlePageChange}
					/>
				</div>
			</section>
		);
	}

	return (
		<section className="flex w-full justify-center">
			<div className="mx-auto w-full max-w-screen-xl p-5">
				<SearchBar query={query} updateUrlOnChange />
				<div className="flex h-full flex-col gap-5 py-5">
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex gap-1 rounded-xl bg-secondary/30 p-1 border-1 border-border h-9 items-center">
							<Button
								className="h-7 px-4"
								variant={!type ? "default" : "ghost"}
								onClick={handleAllClick}
							>
								All
							</Button>
							<Button
								className="h-7 px-4"
								variant={type === "movie" ? "default" : "ghost"}
								onClick={handleMovieClick}
							>
								Movies
							</Button>
							<Button
								className="h-7 px-4"
								variant={type === "tv" ? "default" : "ghost"}
								onClick={handleTVClick}
							>
								Series
							</Button>
						</div>

						{/* Rating Filter — Radix Select */}
						<Select value={minRating} onValueChange={setMinRating}>
							<SelectTrigger className="h-9 gap-2 rounded-xl border-default bg-secondary/30 px-3 text-xs font-medium">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								<SelectItem className="rounded-lg" value="0">
									Any Rating
								</SelectItem>
								<SelectItem className="rounded-lg" value="6">
									6+ Rating
								</SelectItem>
								<SelectItem className="rounded-lg" value="7">
									7+ Rating
								</SelectItem>
								<SelectItem className="rounded-lg" value="8">
									8+ Rating
								</SelectItem>
								<SelectItem className="rounded-lg" value="9">
									9+ Rating
								</SelectItem>
							</SelectContent>
						</Select>

						<span className="ml-auto text-[10px] tracking-wider text-muted-foreground">
							Total results: {data?.total_results ?? 0}
						</span>
					</div>

					<div className="flex min-h-96 w-full items-center justify-center">
						<div className="stagger-grid grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
							{filteredData.map((item) => (
								<MediaCard
									key={item.id}
									id={item.id}
									image={item.poster_path ?? item.profile_path ?? ""}
									known_for_department={item.known_for_department ?? ""}
									media_type={item.media_type as MediaType}
									poster_path={item.poster_path ?? ""}
									rating={item.vote_average ?? 0}
									release_date={
										item.first_air_date ?? item.release_date ?? null
									}
									title={item.title ?? item.name ?? "Untitled"}
									overview={item.overview ?? undefined}
									card_type="horizontal"
								/>
							))}
						</div>
					</div>
					{showPagination && (
						<Pagination
							currentPage={page}
							totalPages={totalPages}
							onPageChange={handlePageChange}
						/>
					)}
				</div>
			</div>
		</section>
	);
}
