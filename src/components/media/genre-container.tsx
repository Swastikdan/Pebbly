import { Badge } from "@/components/ui/badge";
import { ScrollContainer } from "@/components/scroll-container";

export const GenreContainer = (props: {
  genres: Array<{ id: number; name: string }>;
}) => {
  return (
    <ScrollContainer>
      <div className="flex gap-2 py-1">
        {props.genres.map((genre) => (
          <Badge
            key={genre.id}
            aria-label={`Genre: ${genre.name}`}
            className=" text-xs md:text-sm rounded-md"
            role="listitem"
            variant="secondary"
          >
            {genre?.name}
          </Badge>
        ))}
      </div>
    </ScrollContainer>
  );
};
