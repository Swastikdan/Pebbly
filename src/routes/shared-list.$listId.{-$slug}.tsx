import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { Globe, ListOrdered } from "lucide-react";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { CustomListMediaCard } from "@/components/watchlist/custom-list-media-card";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { formatMediaTitle } from "@/lib/utils";
import { getPublicList } from "@/server/fns/lists";
import { unwrap } from "@/server/schema/common";

export const Route = createFileRoute("/shared-list/$listId/{-$slug}")({
	loader: async ({ params, context }) => {
		try {
			await context.queryClient.ensureQueryData({
				queryKey: ["shared-list", params.listId],
				queryFn: () =>
					unwrap(getPublicList({ data: { listId: params.listId } })),
			});
		} catch {
			// Private/missing lists fail with NOT_FOUND — render a 404 rather
			// than leaking that the list exists.
			throw notFound();
		}
		const title = params.slug ? formatMediaTitle.decode(params.slug) : "List";
		return { listId: params.listId, slug: params.slug, title };
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.title
					? `${loaderData.title} | Pebbly`
					: "Page Not Found | Pebbly",
			},
			{
				name: "description",
				content: loaderData?.title
					? `Browse ${loaderData.title} on Pebbly.`
					: "Explore movies and shows on Pebbly.",
			},
		],
	}),

	component: SharedListPage,
});

function SharedListPage() {
	const { listId, slug } = Route.useLoaderData();
	const { data, isLoading, isError } = useQuery({
		queryKey: ["shared-list", listId],
		queryFn: async () => await unwrap(getPublicList({ data: { listId } })),
		enabled: typeof window !== "undefined",
	});

	useCanonicalSlugRedirect({
		entity: "shared-list",
		subPageEntity: "collection",
		id: data?.id,
		title: data?.name,
		incomingPathname: `/shared-list/${listId}/${slug}`,
		isLoading,
	});

	if (isLoading) {
		return <DefaultLoader />;
	}

	if (!data || isError) {
		return <DefaultNotFoundComponent />;
	}

	const isOrdered = data.sortType === "ordered";

	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="w-full max-w-screen-xl p-5">
				<div className="mb-6 flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
					<ShareButton title={data.name} hideLabelOnMobile />
				</div>

				<div className="relative overflow-hidden rounded-xl border border-border/50 dark:border-border/20 px-5 py-4 bg-gradient-to-r from-secondary/40 to-secondary/10 dark:from-zinc-900/60 dark:to-zinc-950/30 backdrop-blur-sm">
					{data.color && (
						<div
							className="absolute right-[-10%] top-[-20%] size-64 rounded-full blur-[100px] opacity-15 pointer-events-none"
							style={{ backgroundColor: data.color }}
						/>
					)}

					<div className="relative z-10 flex items-center gap-3 min-w-0">
						{data.color && (
							<span
								className="size-3 rounded-full shrink-0"
								style={{ backgroundColor: data.color }}
							/>
						)}
						<h1 className="truncate text-xl font-extrabold tracking-tight sm:text-3xl leading-none">
							{data.name}
						</h1>
						<Badge
							variant="secondary"
							className="gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold shrink-0"
						>
							<Globe size={10} />
							Public list
						</Badge>
					</div>

					<div className="relative z-10 mt-2 flex items-center gap-3 text-xs text-muted-foreground/85">
						<span>
							{data.itemCount} {data.itemCount === 1 ? "title" : "titles"}
						</span>
						{isOrdered && (
							<>
								<span>•</span>
								<span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
									<ListOrdered size={12} />
									Ordered
								</span>
							</>
						)}
					</div>

					{data.description && (
						<p className="relative z-10 mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground/75">
							{data.description}
						</p>
					)}
				</div>

				<SilentErrorBoundary>
					{data.itemCount === 0 ? (
						<div className="flex flex-col items-center justify-center gap-4 py-20 text-center text-muted-foreground animate-fade-in-up">
							<p className="text-sm font-semibold text-foreground">
								This collection is empty
							</p>
							<p className="max-w-xs text-xs text-muted-foreground/60">
								The owner hasn't added any titles yet.
							</p>
						</div>
					) : (
						<div className="stagger-grid grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-6 animate-fade-in">
							{data.items.map((item, index) => (
								<CustomListMediaCard
									key={`${item.tmdbId}-${item.mediaType}`}
									item={{
										_id: `${item.tmdbId}-${item.mediaType}`,
										tmdbId: item.tmdbId,
										mediaType: item.mediaType,
										title: item.title ?? undefined,
										image: item.image ?? undefined,
										backdrop: item.backdrop ?? undefined,
										rating: item.rating ?? undefined,
										release_date: item.releaseDate ?? undefined,
										overview: item.overview ?? undefined,
									}}
									listId={data.id}
									priority={index < 7}
									readOnly
									rank={isOrdered ? index + 1 : undefined}
								/>
							))}
						</div>
					)}
				</SilentErrorBoundary>
			</div>
		</section>
	);
}
