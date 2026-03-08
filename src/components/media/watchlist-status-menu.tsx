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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getProgressOption, REACTION_OPTIONS } from "@/constants/watchlist";
import { cn } from "@/lib/utils";
import type { ProgressStatus, ReactionStatus } from "@/types";
import { api } from "../../../convex/_generated/api";

const QUERY_SKIP = "skip" as const;

/** Silently swallows errors from children (e.g. Convex table-not-found). */
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
}) {
	const { isSignedIn } = useUser();
	const [open, setOpen] = useState(false);
	const [listDialogOpen, setListDialogOpen] = useState(false);

	if (!isOnWatchlist) {
		return (
			<Button
				variant="secondary"
				className="gap-2 rounded-lg px-3 text-xs font-semibold h-10"
				onClick={onAdd}
			>
				<Bookmark size={16} />
				Add to Watchlist
			</Button>
		);
	}

	const currentStatus = progressStatus ?? "watch-later";
	const currentOption = getProgressOption(currentStatus);
	const StatusIcon = currentOption.icon;

	const showDropped = mediaType === "tv";

	return (
		<>
			<DropdownMenu open={open} onOpenChange={setOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="secondary"
						className="gap-2 rounded-lg px-3 text-xs font-semibold h-10"
					>
						<StatusIcon size={16} />
						<span className="flex flex-col items-start leading-none">
							<span className="text-[10px] text-muted-foreground font-normal">
								Status
							</span>
							<span>Current: {currentOption.label}</span>
						</span>
						<ChevronDown size={12} className="opacity-50" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="w-72 rounded-2xl p-0"
					onCloseAutoFocus={(e) => e.preventDefault()}
				>
					{/* ── Status ── */}
					<div className="p-3 space-y-2">
						<p className="text-sm font-semibold">Status</p>
						<div className="grid grid-cols-2 gap-1.5">
							<StatusButton
								active={currentStatus === "watch-later"}
								onClick={() => onStatusChange("watch-later")}
							>
								<Clock size={16} />
								Watch Later
							</StatusButton>
							<StatusButton
								active={currentStatus === "watching"}
								onClick={() => onStatusChange("watching")}
							>
								<Eye size={16} />
								Watching
							</StatusButton>
							<StatusButton
								active={currentStatus === "done"}
								onClick={() => onStatusChange("done")}
							>
								<Check size={16} />
								Done
							</StatusButton>
							{showDropped && (
								<StatusButton
									active={currentStatus === "dropped"}
									onClick={() => onStatusChange("dropped")}
								>
									<X size={16} />
									Dropped
								</StatusButton>
							)}
						</div>
					</div>

					<DropdownMenuSeparator className="my-0" />

					{/* ── How was it? ── */}
					<div className="p-3 space-y-2">
						<p className="text-sm font-semibold">How was it?</p>
						<div className="grid grid-cols-4 gap-1.5">
							{REACTION_OPTIONS.map((option) => {
								const isSelected = reaction === option.value;
								return (
									<button
										key={option.value}
										type="button"
										className={cn(
											"flex flex-col items-center gap-1 rounded-xl py-2.5 transition-all",
											isSelected
												? "bg-primary/10 ring-2 ring-primary"
												: "bg-secondary/60 hover:bg-secondary",
										)}
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											onReactionChange(isSelected ? null : option.value);
										}}
									>
										<option.icon size={20} />
										<span className="text-[10px] font-medium text-muted-foreground">
											{option.label}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* ── My Lists (just button) ── */}
					{isSignedIn && (
						<>
							<DropdownMenuSeparator className="my-0" />
							<div className="p-3">
								<button
									type="button"
									className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary/60 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setOpen(false);
										// Small delay so dropdown closes before dialog opens
										setTimeout(() => setListDialogOpen(true), 150);
									}}
								>
									<ListPlus size={16} />
									Add to List
								</button>
							</div>
						</>
					)}

					<DropdownMenuSeparator className="my-0" />

					{/* ── Remove ── */}
					<div className="p-3">
						<button
							type="button"
							className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
							onClick={() => {
								onRemove();
								setOpen(false);
							}}
						>
							<Trash2 size={16} />
							Delete from Watchlist
						</button>
					</div>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* ── Add to List Dialog (opens outside dropdown) ── */}
			{isSignedIn && (
				<SilentErrorBoundary>
					<AddToListDialog
						open={listDialogOpen}
						onOpenChange={setListDialogOpen}
						tmdbId={tmdbId}
						mediaType={mediaType}
					/>
				</SilentErrorBoundary>
			)}
		</>
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
				"flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
				active
					? "bg-primary/10 ring-2 ring-primary text-primary"
					: "bg-secondary/60 hover:bg-secondary text-foreground",
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

// ─── Add to List Dialog ─────────────────────────────────────────────

function AddToListDialog({
	open,
	onOpenChange,
	tmdbId,
	mediaType,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	mediaType: string;
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
								My Lists
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								Add or remove this title from your lists.
							</DialogDescription>
						</DialogHeader>
					</div>

					<div className="px-6">
						<div className="max-h-64 space-y-1 overflow-y-auto">
							{safeList.length === 0 && (
								<p className="py-6 text-center text-sm text-muted-foreground">
									No lists yet. Create one to get started.
								</p>
							)}

							{safeList.map((list) => {
								const isInList = safeItemLists.includes(list._id);
								return (
									<button
										key={list._id}
										type="button"
										className={cn(
											"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
											isInList ? "bg-primary/10" : "hover:bg-secondary/60",
										)}
										onClick={() =>
											toggleListItem({
												listId: list._id,
												tmdbId,
												mediaType,
											})
										}
									>
										<div
											className={cn(
												"flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
												isInList
													? "border-primary bg-primary text-primary-foreground"
													: "border-border",
											)}
										>
											{isInList && <Check size={12} strokeWidth={3} />}
										</div>
										{list.color && (
											<span
												className="size-2.5 shrink-0 rounded-full"
												style={{ backgroundColor: list.color }}
											/>
										)}
										<span className="truncate font-medium">{list.name}</span>
									</button>
								);
							})}
						</div>
					</div>

					<div className="px-6 pb-6 pt-3">
						<button
							type="button"
							className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
							onClick={() => setShowCreateDialog(true)}
						>
							<Plus size={16} />
							Create New List
						</button>
					</div>
				</DialogContent>
			</Dialog>

			<CustomListDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
			/>
		</>
	);
}
