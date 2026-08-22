import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { number, object, optional } from "valibot";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { GoBack } from "@/components/go-back";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { ShareButton } from "@/components/share-button";
import { MediaGrid } from "@/components/ui/media-grid";
import { Pagination } from "@/components/ui/pagination";
import { MAX_PAGINATION_LIMIT } from "@/constants";

const SKELETON_KEYS = Array.from({ length: 12 }, (_, i) => `skeleton-${i}`);

import { getDiscoverMovies, getKeywordDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import type { MediaType } from "@/types";

const keywordPageSearchSchema = object({
	page: optional(number()),
});

export const Route = createFileRoute("/keyword/$id")({
	validateSearch: keywordPageSearchSchema,
	loader: async ({ params }) => {
		const { id } = params;
		const keyword = await getKeywordDetails({ id: Number(id) });
		return { keyword };
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.keyword?.name ?? "Keyword"} Movies | Pebbly`,
			},
			{
				name: "description",
				content: `Browse movies tagged with ${loaderData?.keyword?.name ?? "keyword"} on Pebbly.`,
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
		queryKey: queryKeys.tmdb.discoverKeyword(Number(id), page),
		queryFn: () => getDiscoverMovies({ with_keywords: Number(id), page }),
		enabled: typeof window !== "undefined" && !!id,
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
			if (typeof window !== "undefined") {
				window.scrollTo({ top: 0, behavior: "smooth" });
			}

			navigate({
				to: "/keyword/$id",
				params: { id },
				search: { page: newPage },
			});
		},
		[mediaListData, page, id, navigate],
	);

	useEffect(() => {
		if (pageNumber !== page) {
			setPage(pageNumber ?? 1);
		}
		setIsPending(false);
	}, [pageNumber, page]);

	const isLoading = isMediaListLoading || isMediaListFetching || isPending;
	const results = mediaListData?.results ?? [];
	const hasResults = !!results?.length;
	const showPagination = (mediaListData?.total_pages ?? 0) > 1;
	const totalPages = Math.min(
		mediaListData?.total_pages ?? 0,
		MAX_PAGINATION_LIMIT,
	);

	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="top-0 w-full max-w-screen-xl items-center justify-center p-5">
				<div className="mb-4 flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
					<ShareButton title={`${keyword.name} Movies`} hideLabelOnMobile />
				</div>
				<h1 className="text-start font-bold text-2xl md:text-3xl lg:text-4xl capitalize pb-5">
					{keyword.name} Movies
				</h1>

				<section className="flex h-full flex-col">
					<div className="flex min-h-96 w-full items-center justify-center">
						{isLoading ? (
							<section className="flex h-full flex-col w-full">
								<MediaGrid>
									{SKELETON_KEYS.map((key) => (
										<MediaCardSkeleton key={key} card_type="horizontal" />
									))}
								</MediaGrid>
							</section>
						) : !hasResults || mediaListError ? (
							<DefaultEmptyState
								message="No movies found for this keyword"
								description={false}
							/>
						) : (
							<MediaGrid stagger>
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
										overview={item.overview ?? ""}
									/>
								))}
							</MediaGrid>
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
