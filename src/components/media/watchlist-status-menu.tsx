import { useUser } from "@clerk/clerk-react";
import { Bookmark, ChevronDown, X } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { CustomListPicker } from "@/components/custom-list-picker";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getProgressOption, PROGRESS_OPTIONS } from "@/constants/watchlist";
import { cn } from "@/lib/utils";
import type { ProgressStatus, ReactionStatus } from "@/types";
import { ReactionSelector } from "./reaction-selector";

/** Silently swallows errors from children (e.g. Convex table-not-found). */
class SilentErrorBoundary extends Component<
	{ children: ReactNode },
	{ hasError: boolean }
> {
	state = { hasError: false };
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	componentDidCatch(_error: Error, _info: ErrorInfo) {
		// intentionally silent — custom lists are non-critical
	}
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

	const filteredOptions = PROGRESS_OPTIONS.filter((option) => {
		if (option.tvOnly && mediaType !== "tv") return false;
		return true;
	});

	return (
		<div className="flex items-center gap-1.5">
			<DropdownMenu open={open} onOpenChange={setOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="secondary"
						className="gap-2 rounded-lg px-3 text-xs font-semibold h-10"
					>
						<StatusIcon size={16} />
						{currentOption.label}
						<ChevronDown size={12} className="opacity-50" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56 rounded-xl">
					<DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
						Status
					</DropdownMenuLabel>
					<DropdownMenuGroup>
						{filteredOptions.map((option) => {
							const Icon = option.icon;
							const isActive = currentStatus === option.value;
							return (
								<DropdownMenuItem
									key={option.value}
									className={cn(
										"rounded-lg",
										isActive && "bg-accent font-medium",
									)}
									onSelect={() => {
										onStatusChange(option.value);
									}}
								>
									<Icon size={16} />
									{option.label}
								</DropdownMenuItem>
							);
						})}
					</DropdownMenuGroup>

					<DropdownMenuSeparator />

					<DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
						How did you feel?
					</DropdownMenuLabel>
					<div className="px-2 pb-1.5">
						<ReactionSelector
							value={reaction}
							onChange={(r) => {
								onReactionChange(r);
							}}
						/>
					</div>

					{isSignedIn && (
						<SilentErrorBoundary>
							<DropdownMenuSeparator />
							<CustomListPicker tmdbId={tmdbId} mediaType={mediaType} />
						</SilentErrorBoundary>
					)}

					<DropdownMenuSeparator />

					<DropdownMenuGroup>
						<DropdownMenuItem
							variant="destructive"
							className="rounded-lg"
							onClick={() => {
								onRemove();
								setOpen(false);
							}}
						>
							<X size={16} />
							Remove from Watchlist
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
