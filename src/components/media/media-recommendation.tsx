import React from "react";
import Link from "next/link";
import Recomendations from "./recomendations";
export default function MediaRecomendations({
  id,
  urltitle,
  type,
}: {
  id: number;
  urltitle: string;
  type: "movie" | "tv";
}) {
  return (
    <div className="pb-5">
      <div className="flex flex-col gap-3">
        <Link
          prefetch={false}
          href={`/${type}/${id}/${urltitle}/recommendations`}
          className="w-fit text-xl font-semibold hover:opacity-70 md:text-2xl"
        >
          Recommendations
        </Link>
        <Recomendations media_type={type} media_id={id} />
      </div>
    </div>
  );
}
