import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollContainer } from "@/components/scroll-container";
import { Badge } from "../ui/badge";

export default function GenreContainer({
  genres,
}: {
  genres: Array<{ name: string }>;
}) {
  return (
    <ScrollContainer>
      <div className="flex gap-2 py-1" role="list" aria-label="Genres">
        {genres.map((genre, index) => (
          <Badge
            className="[a&]:hover:bg-primary text-xs md:text-sm"
            variant="secondary"
            key={index}
            role="listitem"
            aria-label={`Genre: ${genre.name}`}
          >
            {genre?.name}
          </Badge>
        ))}
      </div>
    </ScrollContainer>
  );
}
