import { Tmdb } from "@/lib/tmdb";
import type { BasicTv, Tv } from "@/types/tv";

export async function getBasicTvDetails({
  id,
}: {
  id: number;
}): Promise<BasicTv> {
  if (id < -2147483648 || id > 2147483647) {
    throw new Error("Invalid ID");
  }
  const url = `/tv/${id}?&include_adult=true`;
  const result = await Tmdb<BasicTv>(url);

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.data) {
    throw new Error("No data found");
  }

  return result.data;
}

export async function getTvDetails({ id }: { id: number }): Promise<Tv> {
  if (id < -2147483648 || id > 2147483647) {
    throw new Error("Invalid ID");
  }
  const url = `/tv/${id}?include_adult=true&append_to_response=external_ids,images,credits,image,videos,collections,release_dates,recommendations,keywords`;
  const result = await Tmdb<Tv>(url);

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.data) {
    throw new Error("No data found");
  }

  return result.data;
}
