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
import { XCircleIcon } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/pagination";
import {
	clearSearchHistory,
	getSearchHistory,
	removeFromSearchHistory,
	SearchBar,
} from "@/components/ui/search-bar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { HORIZONTAL_MEDIA_GRID_CLASS, MAX_PAGINATION_LIMIT } from "@/constants";
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

	useEffect(() => {
		if (type && filteredData.length === 0 && data?.results?.length) {
			setType(null);
			setMinRating("0");
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
	const baselineNonPersonCount =
		data?.results?.filter((item) => item.media_type !== "person").length ?? 0;
	const hasActiveFilters = type !== null || Number(minRating) > 0;
	const noResultsDueToFilters =
		filteredData.length === 0 && hasActiveFilters && baselineNonPersonCount > 0;
	const totalPages = Math.min(data?.total_pages ?? 0, MAX_PAGINATION_LIMIT);
	const showPagination = hasResults && totalPages > 1;
	const isLoadingState = isLoading || isPending || isFetching;

	if (!query) {
		return (
			<section className="flex w-full justify-center">
				<div className="mx-auto w-full max-w-screen-xl p-5">
					<div className="mb-6 flex flex-col gap-1">
						<h1 className="text-2xl font-bold tracking-tight md:text-3xl animate-fade-in">
							Search
						</h1>
						<p className="text-sm text-muted-foreground">
							Find movies, TV shows, and more
						</p>
					</div>
					<SearchBar query={query} updateUrlOnChange autoFocus />
					<SearchHistory navigate={navigate} />
					<div className="flex flex-col gap-5 py-6">
						<h2 className="text-lg font-semibold">Trending Now</h2>
						{isTrendingLoading ? (
							<div className={HORIZONTAL_MEDIA_GRID_CLASS}>
								{Array.from({ length: 12 }).map((_, index) => (
									<MediaCardSkeleton key={index} card_type="horizontal" />
								))}
							</div>
						) : (
							<div className={`stagger-grid ${HORIZONTAL_MEDIA_GRID_CLASS}`}>
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
						<div className="flex flex-wrap items-center gap-2">
							<div className="flex gap-0.5 rounded-lg bg-secondary/40 p-0.5 ring-1 ring-border/40">
								<Skeleton className="h-7 w-10 rounded-md" />
								<Skeleton className="h-7 w-16 rounded-md" />
								<Skeleton className="h-7 w-14 rounded-md" />
							</div>

							<Skeleton className="h-8 w-[100px] rounded-lg" />

							<Skeleton className="ml-auto h-3 w-[70px] rounded" />
						</div>
						<div className="flex min-h-96 w-full items-center justify-center">
							<div className={HORIZONTAL_MEDIA_GRID_CLASS}>
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

	if (filteredData.length === 0) {
		return (
			<section className="flex w-full justify-center">
				<div className="mx-auto w-full max-w-screen-xl p-5">
					<SearchBar query={query} updateUrlOnChange />
					<DefaultEmptyState
						onReset={() => {
							if (noResultsDueToFilters) {
								setType(null);
								setMinRating("0");
							} else {
								navigate({ to: "/search" });
							}
						}}
						message={
							noResultsDueToFilters
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
					<div className="flex flex-wrap items-center gap-2">
						<div className="flex gap-0.5 rounded-lg bg-secondary/40 p-0.5 h-8 items-center ring-1 ring-border/40">
							<Button
								className="h-7 px-3 text-xs font-semibold rounded-md"
								variant={!type ? "default" : "ghost"}
								onClick={handleAllClick}
							>
								All
							</Button>
							<Button
								className="h-7 px-3 text-xs font-semibold rounded-md"
								variant={type === "movie" ? "default" : "ghost"}
								onClick={handleMovieClick}
							>
								Movies
							</Button>
							<Button
								className="h-7 px-3 text-xs font-semibold rounded-md"
								variant={type === "tv" ? "default" : "ghost"}
								onClick={handleTVClick}
							>
								Series
							</Button>
						</div>

						<Select value={minRating} onValueChange={setMinRating}>
							<SelectTrigger className="h-8 gap-2 rounded-lg border-border/60 bg-secondary/30 px-3 text-xs font-medium">
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
							{data?.total_results ?? 0} results
						</span>
					</div>

					<div className="flex min-h-96 w-full items-center justify-center">
						<div className={`stagger-grid ${HORIZONTAL_MEDIA_GRID_CLASS}`}>
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

function SearchHistory({
	navigate,
}: {
	navigate: ReturnType<typeof useNavigate>;
}) {
	const [history, setHistory] = useState<string[]>([]);

	useEffect(() => {
		setHistory(getSearchHistory());
	}, []);

	if (history.length === 0) return null;

	return (
		<div className="flex flex-col gap-2 pt-4 pb-1">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-medium text-muted-foreground">
					Recent searches
				</h3>
				<Button
					type="button"
					variant="ghost"
					onClick={() => {
						clearSearchHistory();
						setHistory([]);
					}}
					className="h-auto p-0 text-xs text-muted-foreground/60 transition-colors hover:bg-transparent hover:text-foreground"
				>
					Clear all
				</Button>
			</div>
			<div className="flex flex-wrap gap-1.5">
				{history.map((item) => (
					<div
						key={item}
						className="group flex items-center gap-1 rounded-lg bg-secondary/60 px-2.5 py-1 text-sm transition-colors hover:bg-secondary"
					>
						<Button
							type="button"
							variant="ghost"
							className="h-auto cursor-pointer p-0 hover:bg-transparent"
							onClick={() =>
								navigate({
									to: "/search",
									search: { query: item },
								})
							}
						>
							{item}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-4 cursor-pointer p-0 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100 hover:bg-transparent"
							onClick={() => {
								removeFromSearchHistory(item);
								setHistory((prev) => prev.filter((h) => h !== item));
							}}
							aria-label={`Remove "${item}" from history`}
						>
							<XCircleIcon size={14} />
						</Button>
					</div>
				))}
			</div>
		</div>
	);
}
