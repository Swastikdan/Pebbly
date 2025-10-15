import { Star } from "@/components/ui/icons";

export const RatingCount = (props: { rating: number; ratingcount: number }) => {
	const rating_rounded = Math.round(props.rating * 10) / 10;
	const formatted_rating_count =
		props.ratingcount >= 1000
			? `${(props.ratingcount / 1000).toFixed(1)}k`.replace(".0k", "k")
			: props.ratingcount.toLocaleString();

	return (
		<div className="flex items-center space-x-1 font-light">
			<Star className="size-5 fill-yellow-500 text-yellow-500" size={24} />
			<span>{rating_rounded}/10</span>
			{props.ratingcount && <span>{`(${formatted_rating_count} users)`}</span>}
		</div>
	);
};
