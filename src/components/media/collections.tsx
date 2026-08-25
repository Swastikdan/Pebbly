import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCollection } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { formatMediaTitle } from "@/lib/utils";

export const Collections = (props: { id: number }) => {
  const { id } = props;
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tmdb.collection(id),
    queryFn: async () => await getCollection({ id }),
  });

  return (
    <>
      {isLoading ? (
        <Skeleton
          aria-label="Loading collection"
          className="h-48 w-full rounded-2xl md:h-52 lg:h-60"
        />
      ) : (
        <div className="bg-secondary relative h-48 w-full overflow-hidden rounded-2xl border border-black/[0.08] md:h-52 lg:h-60 dark:border-white/[0.08]">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: data?.backdrop_path
                ? `linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.72) 48%, rgba(0,0,0,0.45) 78%, rgba(0,0,0,0.18) 100%), url(https://image.tmdb.org/t/p/w1440_and_h320_multi_faces/${data.backdrop_path})`
                : `linear-gradient(90deg, rgba(0,0,0,0.84) 0%, rgba(0,0,0,0.68) 55%, rgba(0,0,0,0.42) 100%)`,
            }}
          />
          {/* Extra scrim behind text for black/dark images */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent"
          />

          <div className="relative flex h-full flex-col items-start justify-center p-5">
            <span className="font-heading text-lg font-bold text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)] md:text-xl lg:text-2xl xl:text-3xl">
              Part of the {data?.name}
            </span>
            <span className="mt-2 flex flex-wrap text-xs font-light text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] md:text-sm lg:text-base">
              Includes{" "}
              {data?.parts
                ?.slice(0, 5)
                .map((part) => part.title)
                .join(", ") ?? ""}{" "}
              {data?.parts && data?.parts?.length > 5 && (
                <>and {data?.parts?.length - 5} more</>
              )}
            </span>
            <Link
              // @ts-expect-error - correct link
              to={`/collection/${id}/${formatMediaTitle.encode(data?.name ?? "")}`}
            >
              <Button
                variant={null}
                size="lg"
                className="pressable mt-3 border border-black/10 bg-white font-semibold text-black shadow-[0_4px_16px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.2)] hover:bg-white/90 hover:text-black active:bg-white/80 dark:border-white/15 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                View Collection
              </Button>
            </Link>
          </div>
        </div>
      )}
    </>
  );
};
