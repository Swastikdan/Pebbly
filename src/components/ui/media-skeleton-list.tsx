import { memo } from "react";
import { MediaCardSkeleton } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";

export const MediaSkeletonList = memo(
	(props: { count?: number; cardType?: "horizontal" | "vertical" }) => {
		const cardCount = props.count ?? 6;
		const skeletonKeys = Array.from(
			{ length: cardCount },
			(_, i) => `skeleton-${i}`,
		);
		return (
			<ScrollContainer isButtonsVisible={false}>
				<div className="flex gap-2 p-4 first:pl-0 last:pr-0">
					{skeletonKeys.map((key) => (
						<MediaCardSkeleton
							key={key}
							card_type={props.cardType ?? "horizontal"}
						/>
					))}
				</div>
			</ScrollContainer>
		);
	},
);
MediaSkeletonList.displayName = "MediaSkeletonList";
