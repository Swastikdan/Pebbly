import { Chip } from "@heroui/chip";

import { ScrollContainer } from "@/components/scroll-container";

export const GenreContainer = ({
  genres,
}: {
  genres: Array<{ name: string }>;
}) => {
  return (
    <ScrollContainer>
      <div aria-label="Genres" className="flex gap-2 py-1" role="list">
        {genres.map((genre, index) => (
          <Chip
            key={index}
            aria-label={`Genre: ${genre.name}`}
            className=" text-xs md:text-sm rounded-md"
            role="listitem"
            variant="faded"
          >
            {genre?.name}
          </Chip>
        ))}
      </div>
    </ScrollContainer>
  );
};
