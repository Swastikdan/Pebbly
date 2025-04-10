import type { MediaVideos, ResultsEntity } from "@/types/mediavideos";
import { Tmdb } from "@/lib/tmdb";

export async function getVideos({
  id,
  type,
}: {
  id: number;
  type: "movie" | "tv";
}): Promise<ResultsEntity[]> {
  const url = `/${type}/${id}/videos?language=en-US`;
  const result = await Tmdb<MediaVideos>(url);
  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.data?.results) {
    throw new Error("No data returned");
  }
  return result.data.results;
}
