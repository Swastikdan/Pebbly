import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	createLazyFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { GoBack } from "@/components/go-back";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import { XCircleIcon } from "@/components/ui/icons";
import { MediaGrid } from "@/components/ui/media-grid";
import { Pagination } from "@/components/ui/pagination";
import { SearchBar } from "@/components/ui/search-bar";
import {
	Select,
	SelectItem,
	SelectPopup,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_PAGINATION_LIMIT } from "@/constants";
import { getMedia, getSearchResult } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import {
	clearSearchHistory,
	getSearchHistory,
	removeFromSearchHistory,
} from "@/lib/search-history";
import type { SearchResultsEntity } from "@/lib/tmdb-schemas";
import type { MediaType } from "@/types";

type FilterType = MediaType | null;

export const Route = createLazyFileRoute("/search")({
	component: SearchPage,
});

const MIN_RATING_ITEMS = [
	{ value: "0", label: "Any Rating" },
	{ value: "6", label: "6+ Rating" },
	{ value: "7", label: "7+ Rating" },
	{ value: "8", label: "8+ Rating" },
	{ value: "9", label: "9+ Rating" },
];

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
		queryKey: queryKeys.tmdb.search(query, page),
		queryFn: () => getSearchResult({ query, page }),
		enabled: typeof window !== "undefined" && !!query,
		staleTime: 1000 * 60 * 60 * 24,
		// Keep search results bounded in memory; data is still considered
		// fresh for a day (staleTime above), only unused copies are evicted.
		gcTime: 1000 * 60 * 30,
		retry: 2,
		refetchOnWindowFocus: false,
		placeholderData: keepPreviousData,
	});

	const { data: trendingData, isLoading: isTrendingLoading } = useQuery({
		queryKey: queryKeys.tmdb.trendingDay(),
		queryFn: () => getMedia({ type: "trending_day", page: 1 }),
		staleTime: 1000 * 60 * 60 * 24,
		gcTime: 1000 * 60 * 30,
		retry: 2,
		refetchOnWindowFocus: false,
		enabled: typeof window !== "undefined" && !query,
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
	const isLoadingState =
		isLoading || (isPending && !data) || (isFetching && !data);

	let content: React.ReactNode;
	if (!query) {
		content = (
			<>
				<SearchHistory navigate={navigate} />
				<div className="flex flex-col gap-5 py-6">
					<h2 className="text-lg font-semibold">Trending Now</h2>
					{isTrendingLoading ? (
						<MediaGrid>
							{Array.from({ length: 12 }).map((_, index) => (
								<MediaCardSkeleton
									// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
									key={index}
									card_type="horizontal"
								/>
							))}
						</MediaGrid>
					) : (
						<MediaGrid stagger>
							{trendingData?.map((item, index) => (
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
									priority={index < 7}
								/>
							))}
						</MediaGrid>
					)}
				</div>
			</>
		);
	} else if (isLoadingState) {
		content = (
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
					<MediaGrid>
						{Array.from({ length: 12 }).map((_, index) => (
							<MediaCardSkeleton
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
								key={index}
								card_type="horizontal"
							/>
						))}
					</MediaGrid>
				</div>
			</div>
		);
	} else if (error) {
		content = (
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
		);
	} else if (filteredData.length === 0) {
		content = (
			<>
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
			</>
		);
	} else {
		content = (
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

					<Select
						items={MIN_RATING_ITEMS}
						value={minRating}
						onValueChange={(value) => setMinRating(value ?? "0")}
					>
						<SelectTrigger
							size="sm"
							className="w-auto gap-2 rounded-lg border-border/60 bg-secondary/30 px-3 text-xs font-medium"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectPopup className="rounded-xl">
							{MIN_RATING_ITEMS.map((item) => (
								<SelectItem
									key={item.value}
									className="rounded-lg"
									value={item.value}
								>
									{item.label}
								</SelectItem>
							))}
						</SelectPopup>
					</Select>

					<span className="ml-auto text-[10px] tracking-wider text-muted-foreground">
						{data?.total_results ?? 0} results
					</span>
				</div>

				<div className="flex min-h-96 w-full items-center justify-center">
					<MediaGrid stagger>
						{filteredData.map((item, index) => (
							<MediaCard
								key={item.id}
								id={item.id}
								image={item.poster_path ?? item.profile_path ?? ""}
								known_for_department={item.known_for_department ?? ""}
								media_type={item.media_type as MediaType}
								poster_path={item.poster_path ?? ""}
								rating={item.vote_average ?? 0}
								release_date={item.first_air_date ?? item.release_date ?? null}
								title={item.title ?? item.name ?? "Untitled"}
								overview={item.overview ?? undefined}
								card_type="horizontal"
								priority={index < 7}
							/>
						))}
					</MediaGrid>
				</div>
				{showPagination && (
					<Pagination
						currentPage={page}
						totalPages={totalPages}
						onPageChange={handlePageChange}
					/>
				)}
			</div>
		);
	}

	return (
		<section className="flex w-full justify-center">
			<div className="mx-auto w-full max-w-screen-xl p-5">
				<div className="md:hidden mb-4 flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
				</div>
				{!query && (
					<div className="mb-6 flex flex-col gap-1">
						<h1 className="text-2xl font-bold tracking-tight md:text-3xl animate-fade-in">
							Search
						</h1>
						<p className="text-sm text-muted-foreground">
							Find movies, TV shows, and more
						</p>
					</div>
				)}
				<SearchBar query={query} updateUrlOnChange autoFocus={!query} />
				{content}
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
