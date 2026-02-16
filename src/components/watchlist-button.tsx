import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	BookMarkFilledIcon,
	BookMarkIcon,
	TrashBin,
} from "@/components/ui/icons";
import { useToggleWatchlistItem, useWatchlistItem } from "@/hooks/usewatchlist";
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
	const { isOnWatchList } = useWatchlistItem(itemId);

	const handleWatchList = useCallback(async () => {
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
		} catch (error) {
			console.error("Error toggling watchlist:", error);
		}
	}, [title, rating, image, itemId, media_type, release_date, toggle]);

	const showTrash = isOnWatchList && is_on_watchlist_page;
	const showFilled = isOnWatchList && !is_on_watchlist_page;
	return (
		<Button
			variant={is_on_homepage ? "secondary" : "light"}
			aria-label={isOnWatchList ? "Remove from watchlist" : "Add to watchlist"}
			size="icon"
			onClick={handleWatchList}
			className={cn(props.className, "pressable ")}
		>
			{showTrash ? (
				<TrashBin className="size-5" />
			) : showFilled ? (
				<BookMarkFilledIcon className="size-5" />
			) : (
				<BookMarkIcon className="size-5" />
			)}
		</Button>
	);
};

export { WatchlistButton };
