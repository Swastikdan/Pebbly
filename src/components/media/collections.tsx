import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { getCollection } from "@/lib/queries";
import { formatMediaTitle } from "@/lib/utils";

export const Collections = (props: { id: number }) => {
	const { id } = props;
	const { data, isLoading } = useQuery({
		queryKey: ["collection", id],
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
				<div className="bg-secondary relative h-48 w-full overflow-hidden rounded-2xl md:h-52 lg:h-60">
					<div
						aria-hidden="true"
						className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
						style={{
							backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.9036624649859944) 0%, rgba(0,0,0,0.7120098039215687) 55%, rgba(13,13,13,0.2111694677871149) 100%), url(https://image.tmdb.org/t/p/w1440_and_h320_multi_faces/${data?.backdrop_path})`,
						}}
					/>

					<div className="relative flex h-full flex-col items-start justify-center p-5">
						<span className="text-background dark:text-foreground text-lg font-bold md:text-xl lg:text-2xl xl:text-3xl">
							Part of the {data?.name}
						</span>
						<span className="text-background dark:text-foreground mt-2 flex flex-wrap text-xs font-light md:text-sm lg:text-base">
							Includes{" "}
							{data?.parts?.map((part) => part.title)?.join(", ") ?? ""}
						</span>
						<Link
							// @ts-expect-error - correct link
							to={`/collection/${id}/${formatMediaTitle.encode(data?.name ?? "")}`}
						>
							<Button
								className="mt-3 rounded-xl font-medium shadow pressable"
								size="lg"
								variant="secondary"
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
