import type { MediaRecommendations } from "@/types/mediarecommendations";
import { Tmdb } from "@/lib/tmdb";
export async function getMediaRecommendations({
  type,
  id,
  page,
}: {
  type: string;
  id: number;
  page: number;
}) {
  const url = `/${type}/${id}/recommendations?language=en-US&page=${page}`;
  const result = await Tmdb<MediaRecommendations>(url);
  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.data?.results) {
    throw new Error("No data returned");
  }
  return result.data;
}
