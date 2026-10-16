import { memo } from "react";

import { MediaCardSkeleton } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";
import { SkeletonList } from "@/components/ui/skeleton-list";

export const MediaSkeletonList = memo(
  (props: { count?: number; cardType?: "horizontal" | "vertical" }) => {
    const cardCount = props.count ?? 6;
    return (
      <ScrollContainer isButtonsVisible={false}>
        <SkeletonList
          count={cardCount}
          className="flex gap-2 p-4 first:ps-0 last:pe-0"
          render={(index) => (
            <MediaCardSkeleton
              key={index}
              card_type={props.cardType ?? "horizontal"}
            />
          )}
        />
      </ScrollContainer>
    );
  },
);
MediaSkeletonList.displayName = "MediaSkeletonList";
