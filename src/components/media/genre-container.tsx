import { ScrollContainer } from "@/components/scroll-container";
import { Badge } from "@/components/ui/badge";

export const GenreContainer = (props: {
  genres: Array<{ id: number; name: string }>;
}) => {
  return (
    <ScrollContainer>
      <div className="flex gap-1.5 py-1">
        {props.genres.map((genre) => (
          <Badge
            key={genre.id}
            aria-label={`Genre: ${genre.name}`}
            className="inline-flex h-7 items-center rounded-md px-3 text-xs font-medium"
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
