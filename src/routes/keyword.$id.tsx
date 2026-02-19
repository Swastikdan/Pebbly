import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	notFound,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { number, object, optional } from "valibot";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { GoBack } from "@/components/go-back";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { Pagination } from "@/components/ui/pagination";
import { MAX_PAGINATION_LIMIT } from "@/constants";
import { getDiscoverMovies, getKeywordDetails } from "@/lib/queries";
import type { MediaType } from "@/types";

const keywordPageSearchSchema = object({
	page: optional(number()),
});

export const Route = createFileRoute("/keyword/$id")({
	validateSearch: keywordPageSearchSchema,
	loader: async ({ params }) => {
		const id = parseInt(params.id, 10);
		if (Number.isNaN(id)) throw notFound();
		try {
			const keyword = await getKeywordDetails({ id });
			return { keyword };
		} catch {
			throw notFound();
		}
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.keyword.name || "Keyword"} - Movies | Film Fanatic`,
			},
			{
				name: "description",
				content: `Explore movies tagged with ${loaderData?.keyword.name} on Film Fanatic.`,
			},
		],
	}),
	component: KeywordPage,
});

function KeywordPage() {
	const { keyword } = Route.useLoaderData();
	const navigate = useNavigate({ from: "/keyword/$id" });
	const { page: pageNumber } = useSearch({ from: "/keyword/$id" });
	const { id } = Route.useParams();

	const [page, setPage] = useState(pageNumber ?? 1);
	const [isPending, setIsPending] = useState(false);

	const {
		data: mediaListData,
		error: mediaListError,
		isFetching: isMediaListFetching,
		isLoading: isMediaListLoading,
	} = useQuery({
		queryKey: ["discover-movies-keyword", id, page],
		queryFn: () => getDiscoverMovies({ with_keywords: id, page }),
		enabled: !!id,
	});

	const handlePageChange = useCallback(
		(newPage: number) => {
			if (
				!mediaListData ||
				newPage < 1 ||
				newPage > mediaListData.total_pages ||
				newPage === page
			) {
				return;
			}

			setIsPending(true);

			navigate({
				to: "/keyword/$id",
				params: { id },
				search: { page: newPage },
			});
		},
		[mediaListData, page, id, navigate],
	);

	// Sync page from URL and clear pending
	useEffect(() => {
		if (pageNumber !== page) {
			setPage(pageNumber ?? 1);
		}
		setIsPending(false);
	}, [pageNumber, page]);

	const isLoading = isMediaListLoading || isPending || isMediaListFetching;
	const results = mediaListData?.results ?? [];
	const hasResults = !!results?.length;
	const showPagination = hasResults && (mediaListData?.total_pages ?? 0) > 1;
	const totalPages = Math.min(
		mediaListData?.total_pages ?? 0,
		MAX_PAGINATION_LIMIT,
	);

	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="top-0 w-full max-w-screen-xl items-center justify-center p-5">
				<div className="flex flex-col gap-4 pb-5">
					<GoBack className="w-fit" />
					<h1 className="text-start font-bold text-2xl md:text-3xl lg:text-4xl capitalize">
						{keyword.name} Movies
					</h1>
				</div>

				<section className="flex h-full flex-col">
					<div className="flex min-h-96 w-full items-center justify-center">
						{isLoading ? (
							<section className="flex h-full flex-col">
								<div className="grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
									{Array.from({ length: 12 }).map((_, index) => (
										<MediaCardSkeleton key={index} card_type="horizontal" />
									))}
								</div>
							</section>
						) : !hasResults || mediaListError ? (
							<DefaultEmptyState
								message="No movies found for this keyword"
								description={false}
							/>
						) : (
							<div className="stagger-grid grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								{results?.map((item) => (
									<MediaCard
										card_type="horizontal"
										key={item.id}
										id={item.id}
										image={item.poster_path ?? ""}
										known_for_department={item.known_for_department ?? ""}
										media_type={"movie" as MediaType}
										poster_path={item.poster_path ?? ""}
										rating={item.vote_average ?? 0}
										release_date={
											item.first_air_date ?? item.release_date ?? null
										}
										title={item.title ?? item.name ?? "Untitled"}
										overview={item.overview}
									/>
								))}
							</div>
						)}
					</div>

					{showPagination && (
						<Pagination
							currentPage={page}
							totalPages={totalPages}
							onPageChange={handlePageChange}
						/>
					)}
				</section>
			</div>
		</section>
	);
}
