import { Star } from "@/components/ui/icons";

export const RatingCount = (props: { rating: number; ratingcount: number }) => {
	const rating_rounded = Math.round(props.rating * 10) / 10;
	const formatted_rating_count =
		props.ratingcount >= 1000
			? `${(props.ratingcount / 1000).toFixed(1)}k`.replace(".0k", "k")
			: props.ratingcount.toLocaleString();

	return (
		<div className="flex items-center gap-1.5 text-compact">
			<Star className="size-4 fill-yellow-500 text-yellow-500" />
			<span className="font-semibold tabular-nums">{rating_rounded}</span>
			<span className="text-muted-foreground/60">/10</span>
			{props.ratingcount > 0 && (
				<span className="hidden text-xs tabular-nums text-muted-foreground sm:inline-flex">{`(${formatted_rating_count})`}</span>
			)}
		</div>
	);
};
