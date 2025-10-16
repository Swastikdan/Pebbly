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
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { Pagination } from "@/components/ui/pagination";
import {
	MAX_PAGINATION_LIMIT,
	MEDIA_PAGE_SLUGS,
	SITE_CONFIG,
} from "@/constants";
import { getMediaList } from "@/lib/queries";
import type { MediaListQuery, MediaType } from "@/types";

const NAV_ITEMS = SITE_CONFIG.navItems;

const listPageSearchSchema = object({
	page: optional(number()),
});

export const Route = createFileRoute("/list/$type/$slug")({
	validateSearch: listPageSearchSchema,
	loader: async ({ params }) => {
		const { type, slug } = params;

		const isValidSlug = MEDIA_PAGE_SLUGS.some(
			(item) => item.type === type && item.slug === slug,
		);

		if (!isValidSlug) {
			throw notFound();
		}

		const navItem = NAV_ITEMS.find((item) => item.slug === type);
		const subNavItem = navItem?.submenu.find((item) => item.slug === slug);

		if (!navItem || !subNavItem) {
			throw notFound();
		}

		const mediatype = type === "movies" ? "movie" : "tv";
		const query = `${type}_${slug}` as MediaListQuery["type"];

		return { navItem, subNavItem, mediatype, query };
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title:
					loaderData?.navItem && loaderData?.subNavItem
						? `${loaderData.navItem.name} ${loaderData.subNavItem.name} | Film Fanatic`
						: "Page Not Found | Film Fanatic",
			},
			{
				name: "description",
				content:
					loaderData?.navItem && loaderData?.subNavItem
						? `Browse ${loaderData.subNavItem.name} ${loaderData.navItem.name} | Film Fanatic`
						: "Explore movies and shows on Film Fanatic.",
			},
		],
	}),
	component: MediaListPage,
});

function MediaListPage() {
	const { mediatype, query, navItem, subNavItem } = Route.useLoaderData();
	const navigate = useNavigate({ from: "/list/$type/$slug" });
	const { page: pageNumber } = useSearch({ from: "/list/$type/$slug" });

	const [page, setPage] = useState(pageNumber ?? 1);
	const [isPending, setIsPending] = useState(false);

	const {
		data: mediaListData,
		error: mediaListError,
		isFetching: isMediaListFetching,
		isLoading: isMediaListLoading,
	} = useQuery({
		queryKey: ["media-list", query, page],
		queryFn: () => getMediaList({ type: query, page }),
		enabled: !!query,
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
			const querySlug = query.split("_")[1];
			const typeSlug = mediatype === "movie" ? "movies" : "tv-shows";

			navigate({
				to: "/list/$type/$slug",
				params: { type: typeSlug, slug: querySlug },
				search: { page: newPage },
			});
		},
		[mediaListData, page, query, navigate, mediatype],
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
				<h1 className="text-start font-bold text-2xl md:text-3xl lg:text-4xl">
					{subNavItem.name} {navItem.name}
				</h1>

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
								message="No movies or TV shows found"
								description={false}
							/>
						) : (
							<div className="grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								{results?.map((item) => (
									<MediaCard
										card_type="horizontal"
										key={item.id}
										id={item.id}
										image={item.poster_path ?? ""}
										known_for_department={item.known_for_department ?? ""}
										media_type={mediatype as unknown as MediaType}
										poster_path={item.poster_path ?? ""}
										rating={item.vote_average ?? 0}
										release_date={
											item.first_air_date ?? item.release_date ?? null
										}
										title={item.title ?? item.name ?? "Untitled"}
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
