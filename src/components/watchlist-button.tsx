import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	BookMarkFilledIcon,
	BookMarkIcon,
	TrashBin,
} from "@/components/ui/icons";
import { useToggleWatchlistItem, useWatchlistItem } from "@/hooks/use-watchlist";
import { cn } from "@/lib/utils";

interface WatchlistButtonProps {
	id: number;
	title: string;
	rating: number;
	image: string;
	media_type: "movie" | "tv";
	release_date: string | null;
	is_on_homepage?: boolean;
	is_on_watchlist_page?: boolean;
	className?: string;
	overview?: string;
}

const WatchlistButton = (props: WatchlistButtonProps) => {
	const {
		title,
		rating,
		image,
		media_type,
		release_date,
		is_on_homepage,
		is_on_watchlist_page,
		overview,
	} = props;
	const itemId = String(props.id);
	const toggle = useToggleWatchlistItem();
	const { isOnWatchList } = useWatchlistItem(itemId, media_type);

	// Optimistic state — flips instantly, reverts on error
	const [optimisticOn, setOptimisticOn] = useState<boolean | null>(null);
	const [isAnimating, setIsAnimating] = useState(false);
	const [animKey, setAnimKey] = useState(0);

	// Derived active state: prefer optimistic if set, else server truth
	const isActive = optimisticOn !== null ? optimisticOn : isOnWatchList;

	const showTrash = isActive && is_on_watchlist_page;

	const handleWatchList = useCallback(async () => {
		// Immediately flip the UI
		const nextActive = !isActive;
		setOptimisticOn(nextActive);

		// Trigger animation only when adding (not removing on watchlist page)
		if (!is_on_watchlist_page && nextActive) {
			setAnimKey((k) => k + 1);
			setIsAnimating(true);
			setTimeout(() => setIsAnimating(false), 420);
		}

		try {
			await toggle({
				title,
				rating,
				image,
				id: itemId,
				media_type,
				release_date: release_date ?? "",
				overview,
			});
			// Sync back to server truth — clear optimistic override
			setOptimisticOn(null);
		} catch (error) {
			console.error("Error toggling watchlist:", error);
			// Revert on failure
			setOptimisticOn(isActive);
		}
	}, [
		isActive,
		title,
		rating,
		image,
		itemId,
		media_type,
		release_date,
		toggle,
		overview,
		is_on_watchlist_page,
	]);

	return (
		<Button
			variant={is_on_homepage ? "secondary" : "light"}
			aria-label={isActive ? "Remove from watchlist" : "Add to watchlist"}
			aria-pressed={isActive}
			size="icon"
			onClick={handleWatchList}
			data-active={isActive ? "true" : "false"}
			className={cn(
				"pressable relative transition-all duration-200",
				isActive && !is_on_watchlist_page
					? "bg-foreground text-background ring-2 ring-foreground/20 shadow-lg shadow-foreground/10 hover:bg-foreground/90"
					: "bg-black/40 dark:bg-white/10 text-white backdrop-blur-sm hover:bg-black/60 dark:hover:bg-white/20",
				props.className,
			)}
		>
			{showTrash ? (
				<TrashBin className="size-5" />
			) : isActive ? (
				<span
					key={animKey}
					className={cn(
						"flex items-center justify-center",
						isAnimating && "animate-bookmark-pop",
					)}
					style={{ display: "inline-flex" }}
				>
					<BookMarkFilledIcon className="size-5" />
				</span>
			) : (
				<BookMarkIcon className="size-5" />
			)}
		</Button>
	);
};

export { WatchlistButton };
