import React from "react";

import { Recomendations } from "@/components/media/recomendations";
export const MediaRecomendations = ({
  id,
  type,
}: {
  id: number;
  urltitle: string;
  type: "movie" | "tv";
}) => {
  return (
    <div className="pb-5">
      <div className="flex flex-col gap-3">
        <span className="w-fit text-xl font-semibold md:text-2xl">
          Recommendations
        </span>
        <Recomendations media_id={id} media_type={type} />
      </div>
    </div>
  );
};
