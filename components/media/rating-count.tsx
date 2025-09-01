import React, { memo } from "react";

import { Star } from "../icons";

export const RatingCount = memo(
  ({ rating, ratingcount }: { rating: number; ratingcount: number }) => {
    const rating_rounded = Math.round(rating * 10) / 10;
    const formatted_rating_count =
      ratingcount >= 1000
        ? `${(ratingcount / 1000).toFixed(1)}k`.replace(".0k", "k")
        : ratingcount.toLocaleString();

    return (
      <div className="flex items-center space-x-1 font-light">
        <Star className="size-5 fill-yellow-500 text-yellow-500" size={24} />
        <span>{rating_rounded}/10</span>
        {ratingcount && <span>{`(${formatted_rating_count} users)`}</span>}
      </div>
    );
  },
);

RatingCount.displayName = "RatingCount";
