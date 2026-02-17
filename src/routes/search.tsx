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
import { getSearchResult } from "@/lib/queries";
import type { MediaType, SearchResultsEntity } from "@/types";

type FilterType = MediaType | null;

interface ActiveTypes {
	movie: boolean;
	tv: boolean;
}

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

const YEAR_OPTIONS = (() => {
	const currentYear = new Date().getFullYear();
	const years: { value: string; label: string }[] = [
		{ value: "any", label: "Any Year" },
	];
	for (let y = currentYear + 1; y >= 1970; y--) {
		years.push({ value: String(y), label: String(y) });
	}
	return years;
})();

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
	const [releaseYear, setReleaseYear] = useState("any");

	const { data, error, isFetching, isLoading } = useQuery({
		queryKey: ["search", query, page],
		queryFn: () => getSearchResult(query, page),
		enabled: !!query,
		staleTime: 1000 * 60 * 60 * 24,
		gcTime: 1000 * 60 * 60 * 24,
		retry: 2,
		refetchOnWindowFocus: false,
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
			if (releaseYear !== "any") {
				const itemDate = item.first_air_date ?? item.release_date;
				if (!itemDate) return false;
				const itemYear = new Date(itemDate).getFullYear();
				if (itemYear !== Number(releaseYear)) return false;
			}
			return true;
		});
	}, [data?.results, type, minRating, releaseYear]);

	const activeTypes = useMemo<ActiveTypes>(
		() => ({
			movie:
				data?.results?.some((item) => item.media_type === "movie") ?? false,
			tv: data?.results?.some((item) => item.media_type === "tv") ?? false,
		}),
		[data?.results],
	);

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
					<div className="my-10 min-h-[calc(100vh-200px)] w-full" />
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
						<div className="flex h-10 items-center justify-end">
							<div className="flex items-center gap-2">
								{Array.from({ length: 3 }).map((_, index) => (
									<Skeleton key={index} className="h-9 w-[84px] rounded-lg" />
								))}
							</div>
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
						onReset={() => navigate({ to: "/search" })}
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
					{/* Filter Row */}
					<div className="flex flex-wrap items-center gap-3">
						{/* Media type toggle */}
						<div className="flex gap-1 rounded-xl bg-secondary/30 p-1">
							<button
								type="button"
								className={`pressable-small rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
									!type
										? "bg-foreground text-background "
										: "text-foreground/60 hover:text-foreground"
								}`}
								onClick={handleAllClick}
							>
								All
							</button>
							<button
								type="button"
								className={`pressable-small rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
									type === "movie"
										? "bg-foreground text-background "
										: "text-foreground/60 hover:text-foreground"
								}`}
								onClick={handleMovieClick}
								disabled={!activeTypes.movie}
							>
								Movies
							</button>
							<button
								type="button"
								className={`pressable-small rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
									type === "tv"
										? "bg-foreground text-background "
										: "text-foreground/60 hover:text-foreground"
								}`}
								onClick={handleTVClick}
								disabled={!activeTypes.tv}
							>
								Series
							</button>
						</div>

						{/* Rating Filter — Radix Select */}
						<Select value={minRating} onValueChange={setMinRating}>
							<SelectTrigger className="h-8 gap-2 rounded-xl border-default bg-secondary/30 px-3 text-xs font-medium">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								<SelectItem value="0">Any Rating</SelectItem>
								<SelectItem value="6">6+ Rating</SelectItem>
								<SelectItem value="7">7+ Rating</SelectItem>
								<SelectItem value="8">8+ Rating</SelectItem>
								<SelectItem value="9">9+ Rating</SelectItem>
							</SelectContent>
						</Select>

						{/* Year Filter — Radix Select */}
						<Select value={releaseYear} onValueChange={setReleaseYear}>
							<SelectTrigger className="h-8 gap-2 rounded-xl border-default bg-secondary/30 px-3 text-xs font-medium">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="max-h-60 rounded-xl">
								{YEAR_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<span className="ml-auto  text-[10px] tracking-wider text-muted-foreground">
							{filteredData.length} result
							{filteredData.length !== 1 ? "s" : ""}
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
