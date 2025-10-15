import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";
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
  type: "movie" | "tv";
}) => {
  const { id, urltitle, cast, crew, is_more_cast_crew, type } = props;
  const hasCastOrCrew = cast.length > 0 || crew.length > 0;
  if (!hasCastOrCrew) return null;
  return (
    <div className="pb-5">
      <div className="flex flex-col gap-3">
        <Link
          aria-label="View full cast and crew"
          className="w-fit text-xl font-semibold hover:opacity-70 md:text-2xl"
          to={`/${type}/${id}/${encodeURIComponent(urltitle)}/cast-crew`}
        >
          Cast / Crew
        </Link>
        <div className="flex flex-col gap-3">
          <ScrollContainer>
            <div className="flex items-center gap-2">
              {cast.map((cast, index) => (
                <MediaCard
                  key={index}
                  id={cast.id}
                  known_for_department={cast.character}
                  name={cast.name}
                  profile_path={cast.profile_path ?? ""}
                  card_type="person"
                />
              ))}
              {crew.map((crew, index) => (
                <MediaCard
                  key={index}
                  id={crew.id}
                  known_for_department={crew.job}
                  name={crew.name}
                  profile_path={crew.profile_path ?? ""}
                  card_type="person"
                />
              ))}
              {is_more_cast_crew && (
                <Link to={`/${type}/${id}/${urltitle}/cast-crew`}>
                  <Button
                    className="mr-10 ml-5 flex items-center justify-center rounded-lg pressable"
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
            aria-label="View full cast and crew"
            className="w-fit text-lg hover:opacity-70"
            to={`/${type}/${id}/${urltitle}/cast-crew`}
          >
            Full Cast & Crew
          </Link>
        </div>
      </div>
    </div>
  );
};
