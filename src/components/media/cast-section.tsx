import { Link } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import { MediaCard } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import { ArrowRightLine } from "@/components/ui/icons";

export const CastSection = (props: {
  id: number;
  urltitle: string;
  cast: Array<{
    id: number;
    name: string;
    character: string;
    profile_path?: string;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job: string;
    profile_path?: string;
  }>;
  is_more_cast_crew: boolean;
  type: MediaType;
}) => {
  const { id, urltitle, cast, crew, is_more_cast_crew, type } = props;
  const hasCastOrCrew = cast.length > 0 || crew.length > 0;
  if (!hasCastOrCrew) return null;
  const castCrewHref = `/${type}/${id}/${encodeURIComponent(urltitle)}/cast-crew`;
  return (
    <div className="pb-5">
      <div className="flex flex-col gap-3">
        <Link
          aria-label="View full cast and crew"
          className="font-heading w-fit text-lg font-semibold transition-opacity hover:opacity-70 md:text-xl"
          to={castCrewHref}
        >
          Cast / Crew
        </Link>
        <div className="flex flex-col gap-3">
          <ScrollContainer>
            <div className="flex items-center gap-2">
              {cast.map((cast) => (
                <MediaCard
                  key={cast.id}
                  id={cast.id}
                  known_for_department={cast.character}
                  name={cast.name}
                  profile_path={cast.profile_path ?? ""}
                  card_type="person"
                />
              ))}
              {crew.map((crew) => (
                <MediaCard
                  key={crew.id}
                  id={crew.id}
                  known_for_department={crew.job}
                  name={crew.name}
                  profile_path={crew.profile_path ?? ""}
                  card_type="person"
                />
              ))}
              {is_more_cast_crew && (
                <Link to={castCrewHref}>
                  <Button
                    className="pressable mr-10 ml-5 flex items-center justify-center rounded-lg"
                    size="lg"
                    variant="secondary"
                  >
                    View More
                    <ArrowRightLine size={24} />
                  </Button>
                </Link>
              )}
            </div>
          </ScrollContainer>
          <Link
            className="group text-muted-foreground hover:text-foreground w-fit text-sm font-medium transition-colors"
            to={castCrewHref}
          >
            View full cast & crew
            <ArrowRightLine
              size={14}
              className="ml-1 inline-block transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </div>
  );
};
