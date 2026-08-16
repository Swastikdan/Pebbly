import { memo } from "react";
import { MediaCardSkeleton } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";

export const MediaSkeletonList = memo(
	(props: { count?: number; cardType?: "horizontal" | "vertical" }) => {
		const cardCount = props.count ?? 6;
		return (
			<ScrollContainer isButtonsVisible={false}>
				<div className="flex gap-2 p-4 first:pl-0 last:pr-0">
					{Array.from({ length: cardCount }).map((_, index) => (
						<MediaCardSkeleton
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
							key={index}
							card_type={props.cardType ?? "horizontal"}
						/>
					))}
				</div>
			</ScrollContainer>
		);
	},
);
MediaSkeletonList.displayName = "MediaSkeletonList";
