import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import {
	BookmarkCheck,
	BookmarkPlus,
	Calendar,
	Film,
	Globe,
	ListOrdered,
	ListPlus,
	Loader2,
	Share2,
	Tv,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomListMediaCard } from "@/components/watchlist/custom-list-media-card";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { IMAGE_PREFIX } from "@/constants";
import { useClonePublicList } from "@/hooks/use-custom-lists";
import { toast } from "@/hooks/use-toast-store";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { cn, formatMediaTitle } from "@/lib/utils";
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
	const navigate = useNavigate();
	const cloneList = useClonePublicList();
	const [isSaving, setIsSaving] = useState(false);
	const [isSaved, setIsSaved] = useState(false);
	const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");

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

	const movieCount = useMemo(
		() => (data?.items ?? []).filter((i) => i.mediaType === "movie").length,
		[data?.items],
	);
	const tvCount = useMemo(
		() => (data?.items ?? []).filter((i) => i.mediaType === "tv").length,
		[data?.items],
	);

	const filteredItems = useMemo(() => {
		if (!data?.items) return [];
		if (mediaFilter === "all") return data.items;
		return data.items.filter((item) => item.mediaType === mediaFilter);
	}, [data?.items, mediaFilter]);

	// Sample top 3 backdrops for ambient background
	const heroBackdrops = useMemo(() => {
		if (!data?.items) return [];
		return data.items
			.map((item) => item.backdrop ?? item.image)
			.filter((img): img is string => !!img)
			.slice(0, 3);
	}, [data?.items]);

	const handleSaveToAccount = async () => {
		if (!data || isSaving) return;
		setIsSaving(true);
		try {
			const res = await cloneList({
				id: data.id,
				name: data.name,
				color: data.color,
				description: data.description,
				sortType: data.sortType,
				items: data.items,
			});
			setIsSaved(true);
			toast({
				title: "Collection saved to your account!",
				description: `"${res.name}" has been added to your collections.`,
				action: {
					label: "View Collections",
					onClick: () => {
						void navigate({
							to: "/watchlist",
							search: { tab: "collections" },
						});
					},
				},
			});
		} catch (err) {
			console.error("Failed to copy collection:", err);
			toast({
				title: "Failed to save collection",
				description:
					err instanceof Error ? err.message : "Please try again later.",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleShare = async () => {
		if (!data || typeof window === "undefined") return;
		const shareUrl = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({
					title: data.name,
					text: data.description || `Check out ${data.name} on Pebbly`,
					url: shareUrl,
				});
			} catch {
				// User cancelled
			}
		} else {
			try {
				await navigator.clipboard.writeText(shareUrl);
				toast({
					title: "Link copied to clipboard!",
					description: "Anyone with this link can view this collection.",
				});
			} catch {
				toast({
					title: "Failed to copy link",
					description: "Please copy the URL from your browser address bar.",
				});
			}
		}
	};

	if (isLoading) {
		return <DefaultLoader />;
	}

	if (!data || isError) {
		return <DefaultNotFoundComponent />;
	}

	const isOrdered = data.sortType === "ordered";

	return (
		<section className="flex min-h-screen w-full justify-center pb-16">
			<div className="w-full max-w-screen-xl px-4 sm:px-6 pt-4 space-y-6">
				{/* Navigation Bar */}
				<div className="flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
					<div className="flex items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							onClick={handleShare}
							className="h-9 gap-1.5 rounded-xl border border-border/40 bg-card/60 hover:bg-card/90 px-3.5 text-xs font-semibold backdrop-blur-md cursor-pointer transition-all shadow-xs"
						>
							<Share2 size={14} />
							<span className="hidden sm:inline">Share</span>
						</Button>
						<Button
							variant={isSaved ? "outline" : "default"}
							size="sm"
							disabled={isSaving}
							onClick={handleSaveToAccount}
							className={cn(
								"h-9 gap-1.5 rounded-xl px-3.5 text-xs font-semibold cursor-pointer transition-all shadow-sm",
								isSaved
									? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
									: "bg-primary text-primary-foreground hover:bg-primary/90",
							)}
						>
							{isSaving ? (
								<>
									<Loader2 size={14} className="animate-spin" />
									<span>Saving...</span>
								</>
							) : isSaved ? (
								<>
									<BookmarkCheck size={15} className="text-emerald-500" />
									<span>Saved to Collections</span>
								</>
							) : (
								<>
									<BookmarkPlus size={15} />
									<span>Save to My Collections</span>
								</>
							)}
						</Button>
					</div>
				</div>

				{/* Ambient Hero Card */}
				<div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl shadow-xl dark:border-border/30 dark:bg-card/30">
					{/* Ambient Backdrops Collage */}
					{heroBackdrops.length > 0 && (
						<div className="absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-25 overflow-hidden flex">
							{heroBackdrops.map((img, idx) => (
								<div
									key={img}
									className="flex-1 h-full bg-cover bg-center filter blur-xl scale-110"
									style={{
										backgroundImage: `url(${IMAGE_PREFIX}/w780${img})`,
										opacity: 1 - idx * 0.25,
									}}
								/>
							))}
							<div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
							<div className="absolute inset-0 bg-gradient-to-r from-card via-card/60 to-transparent" />
						</div>
					)}

					{/* Custom color accent blur */}
					{data.color && (
						<div
							className="absolute right-[-10%] top-[-20%] size-80 rounded-full blur-[120px] opacity-25 pointer-events-none"
							style={{ backgroundColor: data.color }}
						/>
					)}

					<div className="relative z-10 p-6 sm:p-8 space-y-4">
						<div className="flex flex-wrap items-center gap-2 text-xs">
							<Badge
								variant="secondary"
								className="gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs"
							>
								<Globe size={11} className="text-primary" />
								Public Collection
							</Badge>

							{isOrdered && (
								<Badge
									variant="outline"
									className="gap-1 rounded-lg px-2.5 py-1 text-xs font-medium border-border/60 bg-background/50 backdrop-blur-xs"
								>
									<ListOrdered size={12} className="text-primary" />
									Ranked & Ordered
								</Badge>
							)}

							{movieCount > 0 && (
								<Badge
									variant="outline"
									className="gap-1 rounded-lg px-2.5 py-1 text-xs font-medium border-border/60 bg-background/50 backdrop-blur-xs"
								>
									<Film size={11} className="text-muted-foreground" />
									{movieCount} {movieCount === 1 ? "Movie" : "Movies"}
								</Badge>
							)}

							{tvCount > 0 && (
								<Badge
									variant="outline"
									className="gap-1 rounded-lg px-2.5 py-1 text-xs font-medium border-border/60 bg-background/50 backdrop-blur-xs"
								>
									<Tv size={11} className="text-muted-foreground" />
									{tvCount} {tvCount === 1 ? "TV Show" : "TV Shows"}
								</Badge>
							)}

							<span className="flex items-center gap-1 text-xs text-muted-foreground/80 pl-1">
								<Calendar size={12} />
								Created{" "}
								{new Date(data.createdAt).toLocaleDateString(undefined, {
									month: "short",
									year: "numeric",
								})}
							</span>
						</div>

						{/* Title with color indicator */}
						<div className="flex items-start gap-3.5">
							{data.color && (
								<span
									className="size-4 rounded-full mt-1.5 shrink-0 shadow-sm ring-2 ring-background"
									style={{ backgroundColor: data.color }}
								/>
							)}
							<h1 className="text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl leading-tight">
								{data.name}
							</h1>
						</div>

						{/* Description */}
						{data.description && (
							<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground/90 font-normal">
								{data.description}
							</p>
						)}
					</div>
				</div>

				{/* Filters & Count Bar */}
				{data.items.length > 0 && (
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-3">
						<div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hidden">
							{(["all", "movie", "tv"] as const).map((filter) => {
								const isActive = mediaFilter === filter;
								const count = data.items.filter(
									(item) => filter === "all" || item.mediaType === filter,
								).length;
								const label =
									filter === "all"
										? "All Titles"
										: filter === "movie"
											? "Movies"
											: "TV Shows";

								if (filter !== "all" && count === 0) return null;

								return (
									<Button
										key={filter}
										type="button"
										variant={isActive ? "default" : "ghost"}
										size="sm"
										onClick={() => setMediaFilter(filter)}
										className={cn(
											"h-8 gap-1.5 rounded-xl px-3 text-xs font-semibold cursor-pointer transition-all whitespace-nowrap",
											isActive
												? "bg-foreground text-background shadow-xs"
												: "text-muted-foreground hover:bg-secondary hover:text-foreground",
										)}
									>
										{label}
										<span className="text-[10px] tabular-nums opacity-60">
											{count}
										</span>
									</Button>
								);
							})}
						</div>

						<span className="text-xs text-muted-foreground font-medium">
							Showing {filteredItems.length} of {data.itemCount}{" "}
							{data.itemCount === 1 ? "title" : "titles"}
						</span>
					</div>
				)}

				{/* Media Items Grid */}
				<SilentErrorBoundary>
					{data.itemCount === 0 ? (
						<div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-muted-foreground animate-fade-in-up">
							<div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/70 border border-border/30">
								<ListPlus className="size-6 text-muted-foreground/80" />
							</div>
							<div>
								<p className="text-base font-semibold text-foreground">
									This collection is empty
								</p>
								<p className="max-w-xs text-xs text-muted-foreground/70 mt-1">
									The creator hasn't added any movies or TV shows yet.
								</p>
							</div>
						</div>
					) : filteredItems.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
							<p className="text-sm">
								No {mediaFilter === "movie" ? "movies" : "TV shows"} in this
								collection.
							</p>
						</div>
					) : (
						<div className="stagger-grid grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in">
							{filteredItems.map((item, index) => (
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
									priority={index < 8}
									readOnly
									rank={isOrdered ? (item.position ?? index) + 1 : undefined}
								/>
							))}
						</div>
					)}
				</SilentErrorBoundary>
			</div>
		</section>
	);
}
