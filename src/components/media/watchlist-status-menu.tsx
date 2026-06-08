import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import {
	Bookmark,
	Check,
	ChevronDown,
	Clock,
	Eye,
	ListPlus,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { CustomListDialog } from "@/components/custom-list-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getProgressOption, REACTION_OPTIONS } from "@/constants/watchlist";
import { cn } from "@/lib/utils";
import type { ProgressStatus, ReactionStatus } from "@/types";
import { api } from "../../../convex/_generated/api";

const QUERY_SKIP = "skip" as const;

class SilentErrorBoundary extends Component<
	{ children: ReactNode },
	{ hasError: boolean }
> {
	state = { hasError: false };
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	componentDidCatch(_error: Error, _info: ErrorInfo) {}
	render() {
		if (this.state.hasError) return null;
		return this.props.children;
	}
}

export type MediaMetadataForList = {
	title?: string;
	image?: string;
	backdrop?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

export function WatchlistStatusMenu({
	isOnWatchlist,
	progressStatus,
	reaction,
	mediaType,
	tmdbId,
	onAdd,
	onStatusChange,
	onReactionChange,
	onRemove,
	metadata,
}: {
	isOnWatchlist: boolean;
	progressStatus: ProgressStatus | null;
	reaction: ReactionStatus | null;
	mediaType: "movie" | "tv";
	tmdbId: number;
	onAdd: () => void;
	onStatusChange: (status: ProgressStatus) => void;
	onReactionChange: (reaction: ReactionStatus | null) => void;
	onRemove: () => void;
	metadata?: MediaMetadataForList;
}) {
	const { isSignedIn } = useUser();
	const [open, setOpen] = useState(false);
	const [listDialogOpen, setListDialogOpen] = useState(false);

	const currentStatus = progressStatus ?? "watch-later";
	const currentOption = getProgressOption(currentStatus);
	const StatusIcon = isOnWatchlist ? currentOption.icon : Bookmark;

	if (!isSignedIn) {
		return (
			<div className="flex items-center gap-2">
				<Button
					variant="secondary"
					className="h-10 w-10 sm:w-auto sm:min-w-fit gap-0 sm:gap-2 rounded-xl px-0 sm:px-4 text-xs font-semibold border border-border/10 hover:bg-secondary/80 transition-all flex items-center justify-center"
					onClick={() => (isOnWatchlist ? onRemove() : onAdd())}
				>
					<StatusIcon size={16} />
					<span className="hidden sm:inline">
						{isOnWatchlist
							? `Current: ${currentOption.label}`
							: "Add to Watchlist"}
					</span>
				</Button>
				<Button
					variant="secondary"
					className="h-10 w-10 sm:w-auto sm:min-w-fit gap-0 sm:gap-2 rounded-xl px-0 sm:px-4 text-xs font-semibold border border-border/10 hover:bg-secondary/80 transition-all flex items-center justify-center"
					onClick={onAdd}
				>
					<ListPlus size={16} />
					<span className="hidden sm:inline">Add to Collection</span>
				</Button>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			{!isOnWatchlist ? (
				<Button
					variant="secondary"
					className="h-10 w-10 sm:w-auto sm:min-w-fit gap-0 sm:gap-2 rounded-xl px-0 sm:px-4 text-xs font-semibold border border-border/10 hover:bg-secondary/80 transition-all cursor-pointer flex items-center justify-center"
					onClick={onAdd}
				>
					<Bookmark size={16} />
					<span className="hidden sm:inline">Add to Watchlist</span>
				</Button>
			) : (
				<DropdownMenu open={open} onOpenChange={setOpen}>
					<DropdownMenuTrigger asChild>
						<Button
							variant="secondary"
							className="h-10 w-10 sm:w-auto sm:min-w-fit gap-0 sm:gap-2 rounded-xl px-0 sm:px-4 text-xs font-semibold border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all cursor-pointer flex items-center justify-center"
						>
							<StatusIcon
								size={16}
								className="text-primary animate-bookmark-pop"
							/>
							<span className="hidden sm:inline">{currentOption.label}</span>
							<ChevronDown
								size={14}
								className={cn(
									"hidden sm:inline opacity-75 transition-transform duration-200",
									open && "rotate-180",
								)}
							/>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						className="w-80 rounded-2xl p-0 border border-border/40 bg-background/95 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
						onCloseAutoFocus={(e) => e.preventDefault()}
					>
						<div className="flex items-center justify-between border-b border-border/20 px-4 py-3">
							<span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
								Watchlist Status
							</span>
							<button
								type="button"
								onClick={() => {
									onRemove();
									setOpen(false);
								}}
								className="text-[11px] font-semibold text-destructive hover:underline cursor-pointer"
							>
								Remove
							</button>
						</div>

						<div className="p-2.5 space-y-0.5">
							<StatusButton
								active={currentStatus === "watch-later"}
								onClick={() => onStatusChange("watch-later")}
							>
								<Clock
									size={14}
									className={
										currentStatus === "watch-later"
											? "text-primary"
											: "text-muted-foreground"
									}
								/>
								<span>Watch Later</span>
							</StatusButton>
							<StatusButton
								active={currentStatus === "watching"}
								onClick={() => onStatusChange("watching")}
							>
								<Eye
									size={14}
									className={
										currentStatus === "watching"
											? "text-primary"
											: "text-muted-foreground"
									}
								/>
								<span>Watching</span>
							</StatusButton>
							<StatusButton
								active={currentStatus === "done"}
								onClick={() => onStatusChange("done")}
							>
								<Check
									size={14}
									className={
										currentStatus === "done"
											? "text-primary"
											: "text-muted-foreground"
									}
								/>
								<span>Done</span>
							</StatusButton>
							{mediaType === "tv" && (
								<StatusButton
									active={currentStatus === "dropped"}
									onClick={() => onStatusChange("dropped")}
								>
									<X
										size={14}
										className={
											currentStatus === "dropped"
												? "text-primary"
												: "text-muted-foreground"
										}
									/>
									<span>Dropped</span>
								</StatusButton>
							)}
						</div>

						<div className="p-3 border-t border-border/20 space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
									Reaction
								</span>
							</div>
							<div className="grid grid-cols-4 gap-2">
								{REACTION_OPTIONS.map((option) => {
									const isSelected = reaction === option.value;
									return (
										<button
											key={option.value}
											type="button"
											className={cn(
												"flex flex-col items-center justify-center gap-1.5 rounded-xl py-2 px-1 transition-all duration-200 border cursor-pointer",
												isSelected
													? "bg-primary/10 border-primary/30 text-primary"
													: "bg-secondary/40 border-transparent hover:bg-secondary/85 text-muted-foreground hover:text-foreground",
											)}
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												onReactionChange(isSelected ? null : option.value);
											}}
										>
											<option.icon
												size={18}
												className={
													isSelected ? "text-primary" : "text-muted-foreground"
												}
											/>
											<span className="text-[9px] font-bold tracking-tight">
												{option.label}
											</span>
										</button>
									);
								})}
							</div>
						</div>

						<div className="p-2.5 border-t border-border/20">
							<button
								type="button"
								className="flex items-center justify-center gap-2 w-full rounded-xl py-2 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors border border-destructive/25 cursor-pointer"
								onClick={() => {
									onRemove();
									setOpen(false);
								}}
							>
								<Trash2 size={14} />
								<span>Delete from Watchlist</span>
							</button>
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			)}

			<Button
				variant="secondary"
				className="h-10 w-10 sm:w-auto sm:min-w-fit gap-0 sm:gap-2 rounded-xl px-0 sm:px-4 text-xs font-semibold border border-border/10 hover:bg-secondary/80 transition-all cursor-pointer flex items-center justify-center"
				onClick={() => setListDialogOpen(true)}
			>
				<ListPlus size={16} />
				<span className="hidden sm:inline">Add to Collection</span>
			</Button>

			{isSignedIn && (
				<SilentErrorBoundary>
					<AddToListDialog
						open={listDialogOpen}
						onOpenChange={setListDialogOpen}
						tmdbId={tmdbId}
						mediaType={mediaType}
						metadata={metadata}
					/>
				</SilentErrorBoundary>
			)}
		</div>
	);
}

function StatusButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			className={cn(
				"flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 text-left border border-transparent cursor-pointer",
				active
					? "bg-primary/10 text-primary border-primary/20 font-bold"
					: "hover:bg-secondary/60 text-muted-foreground hover:text-foreground",
			)}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onClick();
			}}
		>
			{children}
		</button>
	);
}

function AddToListDialog({
	open,
	onOpenChange,
	tmdbId,
	mediaType,
	metadata,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	mediaType: string;
	metadata?: MediaMetadataForList;
}) {
	const { isSignedIn } = useUser();
	const lists = useQuery(
		api.watchlist.getCustomLists,
		isSignedIn ? {} : QUERY_SKIP,
	);
	const itemLists = useQuery(
		api.watchlist.getItemLists,
		isSignedIn ? { tmdbId, mediaType } : QUERY_SKIP,
	);
	const toggleListItem = useMutation(api.watchlist.toggleListItem);
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	const safeList = lists ?? [];
	const safeItemLists = itemLists ?? [];

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-[380px] overflow-hidden rounded-2xl p-0">
					<div className="px-6 pt-6 pb-2">
						<DialogHeader className="space-y-1">
							<DialogTitle className="text-base font-semibold tracking-tight">
								My Collections
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								Add or remove this title from your collections.
							</DialogDescription>
						</DialogHeader>
					</div>

					<div className="px-6">
						<div className="max-h-64 space-y-1.5 overflow-y-auto">
							{safeList.length === 0 && (
								<p className="py-6 text-center text-sm text-muted-foreground">
									No collections yet. Create one to get started.
								</p>
							)}

							{safeList.map((list) => {
								const isInList = safeItemLists.includes(list._id);
								return (
									<button
										key={list._id}
										type="button"
										className={cn(
											"flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition-all duration-200 border border-transparent",
											isInList
												? "bg-primary/[0.03] border-primary/10 text-foreground font-semibold"
												: "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
										)}
										onClick={() =>
											toggleListItem({
												listId: list._id,
												tmdbId,
												mediaType,
												title: metadata?.title,
												image: metadata?.image,
												backdrop: metadata?.backdrop,
												rating: metadata?.rating,
												release_date: metadata?.release_date,
												overview: metadata?.overview,
											})
										}
									>
										<div className="flex items-center gap-3 min-w-0">
											<div
												className={cn(
													"flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
													isInList
														? "border-primary bg-primary text-primary-foreground scale-105"
														: "border-muted-foreground/30 bg-transparent",
												)}
											>
												{isInList && <Check size={11} strokeWidth={3} />}
											</div>
											<span className="truncate">{list.name}</span>
										</div>
										{list.color && (
											<span
												className="size-2.5 shrink-0 rounded-full shadow-sm"
												style={{ backgroundColor: list.color }}
											/>
										)}
									</button>
								);
							})}
						</div>
					</div>

					<div className="px-6 pb-6 pt-3">
						<Button
							type="button"
							variant="outline"
							className="h-auto w-full justify-center gap-2 rounded-xl border-dashed py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
							onClick={() => setShowCreateDialog(true)}
						>
							<Plus size={16} />
							Create New Collection
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<CustomListDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				autoAddMedia={{
					tmdbId,
					mediaType,
					title: metadata?.title,
					image: metadata?.image,
					backdrop: metadata?.backdrop,
					rating: metadata?.rating,
					release_date: metadata?.release_date,
					overview: metadata?.overview,
				}}
			/>
		</>
	);
}
