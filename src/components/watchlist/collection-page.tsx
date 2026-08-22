import { SignInButton, useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
	Copy,
	Globe,
	ListOrdered,
	ListPlus,
	Lock,
	Pencil,
	Sparkles,
	Trash2,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomListMediaCard } from "@/components/watchlist/custom-list-media-card";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import {
	useCloneList,
	useCreateCustomList,
	useDeleteCustomList,
	useReorderListItems,
	useUpdateCustomList,
} from "@/hooks/use-custom-lists";
import { toast } from "@/hooks/use-toast-store";
import { queryKeys } from "@/lib/query/keys";
import { cn, formatMediaTitle } from "@/lib/utils";
import { getCollectionPage } from "@/server/fns/lists";
import { unwrap } from "@/server/schema/common";

const CustomListDialog = lazy(() =>
	import("@/components/custom-list-dialog").then((m) => ({
		default: m.CustomListDialog,
	})),
);

export function CollectionPage({ listId }: { listId: string }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { isSignedIn } = useUser();

	const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");
	const [editing, setEditing] = useState(false);
	const [cloning, setCloning] = useState(false);

	const pageQuery = useQuery({
		queryKey: queryKeys.lists.collectionPage(listId),
		queryFn: () => unwrap(getCollectionPage({ data: { listId } })),
	});

	const updateList = useUpdateCustomList();
	const deleteCustomList = useDeleteCustomList();
	const createCustomList = useCreateCustomList();
	const cloneList = useCloneList();
	const reorderItems = useReorderListItems();

	const refreshPage = () =>
		queryClient.invalidateQueries({
			queryKey: queryKeys.lists.collectionPage(listId),
		});

	if (pageQuery.error) {
		return <DefaultNotFoundComponent />;
	}

	if (pageQuery.isPending || !pageQuery.data) {
		return <DefaultLoader />;
	}

	const payload = pageQuery.data;
	const isOwner = payload.role === "owner";
	const list = payload.list;
	const items = payload.items;
	const isPebblyPicks = list.listType === "pebbly-picks";
	const isOrdered = list.sortType === "ordered";
	const canManage = isOwner && !isPebblyPicks;
	const isPublic = list.visibility === "public";

	const indexed = items.map((item, index) => ({ item, index }));
	const filtered =
		mediaFilter === "all"
			? indexed
			: indexed.filter(({ item }) => item.mediaType === mediaFilter);

	const handleMove = (index: number, dir: -1 | 1) => {
		const target = index + dir;
		if (target < 0 || target >= items.length) return;
		const order = [...items];
		[order[index], order[target]] = [order[target], order[index]];
		reorderItems({
			listId,
			orderedItems: order.map((entry) => ({
				tmdbId: entry.tmdbId,
				mediaType: entry.mediaType,
			})),
		})
			.then(refreshPage)
			.catch(console.error);
	};

	const handleVisibility = (next: "public" | "private") => {
		updateList({ listId, visibility: next })
			.then(refreshPage)
			.then(() =>
				toast({
					title:
						next === "public"
							? "Collection is public"
							: "Collection is private",
					description:
						next === "public"
							? "Anyone with the link can now view it."
							: "Only you can see this collection now.",
				}),
			)
			.catch(console.error);
	};

	const handleCopyLink = () => {
		navigator.clipboard
			.writeText(window.location.href)
			.then(() =>
				toast({
					title: "Link copied",
					description: "Anyone with this link can view your collection.",
				}),
			)
			.catch(() => toast({ title: "Couldn't copy link" }));
	};

	const handleDelete = () => {
		deleteCustomList(listId);
		toast({
			title: "Collection deleted",
			description: list.name,
			action: {
				label: "Undo",
				onClick: () => {
					void createCustomList({
						name: list.name,
						color: list.color ?? undefined,
						description: list.description ?? undefined,
						visibility: (list.visibility as "public" | "private") ?? undefined,
						sortType: list.sortType,
					});
				},
			},
		});
		router.navigate({ to: "/watchlist", search: { tab: "collections" } });
	};

	const handleClone = () => {
		setCloning(true);
		cloneList(listId)
			.then((newId) => {
				toast({
					title: "Saved to My Collections",
					description: `"${list.name} (copy)" was added as a private collection.`,
				});
				return router.navigate({
					to: `/c/${newId}/${formatMediaTitle.encode(list.name)}`,
				});
			})
			.catch(console.error)
			.finally(() => setCloning(false));
	};

	return (
		<div className="animate-fade-in space-y-6">
			<div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border/50 dark:border-border/20 px-5 py-4 overflow-hidden bg-gradient-to-r from-secondary/40 to-secondary/10 dark:from-zinc-900/60 dark:to-zinc-950/30 backdrop-blur-sm">
				{list.color && (
					<div
						className="absolute right-[-10%] top-[-20%] size-64 rounded-full blur-[100px] opacity-15 pointer-events-none"
						style={{ backgroundColor: list.color }}
					/>
				)}

				<div className="flex items-center gap-4 min-w-0 z-10">
					<GoBack className="shrink-0 border border-border/20 bg-background/50 backdrop-blur-sm hover:bg-background/80" />
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							{list.color && (
								<span
									className="size-3 rounded-full shrink-0"
									style={{ backgroundColor: list.color }}
								/>
							)}
							<h1 className="truncate text-xl font-extrabold tracking-tight sm:text-3xl leading-none">
								{list.name}
							</h1>
							{isPebblyPicks && (
								<span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500/15 to-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-500 dark:text-violet-300 ring-1 ring-violet-500/30">
									<Sparkles size={11} />
									AI Curated
								</span>
							)}
							{isOrdered && (
								<span className="inline-flex items-center gap-1 rounded-lg bg-secondary/80 px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
									<ListOrdered size={11} />
									Ranked
								</span>
							)}
							{(isOwner || isPublic) && (
								<span className="inline-flex items-center gap-1 rounded-lg bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
									{isPublic ? <Globe size={11} /> : <Lock size={11} />}
									{isPublic ? "Public" : "Private"}
								</span>
							)}
						</div>
						{list.description && (
							<p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground/85">
								{list.description}
							</p>
						)}
						<div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/85">
							<span>{items.length} titles</span>
							<span>•</span>
							<span>
								Created{" "}
								{new Date(list.createdAt).toLocaleDateString(undefined, {
									month: "short",
									year: "numeric",
								})}
							</span>
						</div>
					</div>
				</div>

				{canManage ? (
					<div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center z-10">
						{/* Live visibility switch */}
						<div className="flex p-1 rounded-xl bg-muted/70 border border-border/50">
							<button
								type="button"
								onClick={() => !isPublic && handleVisibility("public")}
								className={cn(
									"flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[10.5px] rounded-lg cursor-pointer transition-[color,background-color,border-color,box-shadow] border",
									isPublic
										? "bg-background text-foreground border-border/40 shadow-xs dark:shadow-none font-semibold"
										: "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
								)}
								aria-pressed={isPublic}
							>
								<Globe size={11} />
								Public
							</button>
							<button
								type="button"
								onClick={() => isPublic && handleVisibility("private")}
								className={cn(
									"flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[10.5px] rounded-lg cursor-pointer transition-[color,background-color,border-color,box-shadow] border",
									!isPublic
										? "bg-background text-foreground border-border/40 shadow-xs dark:shadow-none font-semibold"
										: "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
								)}
								aria-pressed={!isPublic}
							>
								<Lock size={11} />
								Private
							</button>
						</div>

						{isPublic && (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={handleCopyLink}
								className="border border-border/20 bg-background/50 backdrop-blur-sm text-muted-foreground hover:bg-background/80 hover:text-foreground"
								aria-label="Copy public link"
								title="Copy public link"
							>
								<Copy size={15} />
							</Button>
						)}

						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setEditing(true)}
							className="border border-border/20 bg-background/50 backdrop-blur-sm text-muted-foreground hover:bg-background/80 hover:text-foreground"
							aria-label={`Edit ${list.name}`}
						>
							<Pencil size={15} />
						</Button>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="border border-border/20 bg-background/50 backdrop-blur-sm text-muted-foreground hover:bg-background/80 hover:text-foreground"
									aria-label={`Options for ${list.name}`}
								>
									<Trash2 size={15} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-36 rounded-xl shadow-xl"
							>
								<DropdownMenuItem
									variant="destructive"
									className="rounded-lg gap-2 text-xs py-2 text-destructive focus:bg-destructive/15 focus:text-destructive"
									onSelect={handleDelete}
								>
									<Trash2 size={14} />
									Delete Collection
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				) : (
					<div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center z-10">
						{isSignedIn ? (
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={handleClone}
								disabled={cloning}
								className="gap-1.5 text-xs border border-border/40 bg-background/60 backdrop-blur-sm hover:bg-background/90"
							>
								<Copy size={13} />
								{cloning ? "Saving..." : "Save a copy"}
							</Button>
						) : (
							<SignInButton mode="modal">
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="gap-1.5 text-xs border border-border/40 bg-background/60 backdrop-blur-sm hover:bg-background/90"
								>
									<Copy size={13} />
									Save a copy
								</Button>
							</SignInButton>
						)}
						<ShareButton title={list.name} hideLabelOnMobile />
					</div>
				)}
			</div>

			{items.length > 0 && (
				<div className="flex gap-1.5 border-b border-border/20 pb-2 overflow-x-auto scrollbar-hidden">
					{(["all", "movie", "tv"] as const).map((filter) => {
						const isActive = mediaFilter === filter;
						const count = items.filter(
							(item) => filter === "all" || item.mediaType === filter,
						).length;
						const label =
							filter === "all"
								? "All"
								: filter === "movie"
									? "Movies"
									: "TV Shows";

						return (
							<Button
								key={filter}
								type="button"
								variant={isActive ? "default" : "ghost"}
								onClick={() => setMediaFilter(filter)}
								className={cn(
									"h-auto items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
									isActive
										? "bg-foreground text-background"
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
			)}

			<SilentErrorBoundary>
				{items.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-4 py-20 text-center text-muted-foreground animate-fade-in-up">
						<div className="flex size-14 items-center justify-center rounded-xl bg-secondary/60">
							<ListPlus className="size-6 text-muted-foreground/80" />
						</div>
						<div>
							<p className="text-sm font-semibold text-foreground">
								This collection is empty
							</p>
							<p className="max-w-xs text-xs text-muted-foreground/60 mt-1">
								Add movies and TV shows from their detail pages to build your
								collection.
							</p>
						</div>
					</div>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
						<p className="text-xs">
							No {mediaFilter === "movie" ? "movies" : "TV shows"} in this list.
						</p>
					</div>
				) : (
					<div className="stagger-grid grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
						{filtered.map(({ item, index }) => (
							<CustomListMediaCard
								key={`${item.tmdbId}-${item.mediaType}`}
								item={{
									tmdbId: item.tmdbId,
									mediaType: item.mediaType,
									title: item.title ?? undefined,
									image: item.image ?? undefined,
									backdrop: item.backdrop ?? undefined,
									rating: item.rating ?? undefined,
									release_date: item.release_date ?? undefined,
									overview: item.overview ?? undefined,
									progressStatus:
										item.progressStatus === null
											? undefined
											: item.progressStatus,
									reaction: item.reaction === null ? undefined : item.reaction,
								}}
								listId={listId}
								priority={index < 7}
								readOnly={!canManage}
								rank={isOrdered ? index + 1 : undefined}
								onMove={
									canManage && isOrdered
										? (dir) => handleMove(index, dir)
										: undefined
								}
								canMoveUp={index > 0}
								canMoveDown={index < items.length - 1}
							/>
						))}
					</div>
				)}
			</SilentErrorBoundary>

			{editing && (
				<Suspense fallback={null}>
					<CustomListDialog
						open
						onOpenChange={(open) => {
							if (!open) {
								setEditing(false);
								refreshPage();
							}
						}}
						listId={list.id}
						initialName={list.name}
						initialColor={list.color ?? undefined}
						initialDescription={list.description ?? undefined}
						initialVisibility={
							(list.visibility as "public" | "private") ?? "private"
						}
						initialSortType={list.sortType}
					/>
				</Suspense>
			)}
		</div>
	);
}
