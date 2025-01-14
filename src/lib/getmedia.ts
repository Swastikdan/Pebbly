import { Tmdb } from '@/lib/tmdb'
import {
  MediaListQuery,
  MediaListEntity,
  MediaListResultsEntity,
} from '@/types/media'

export async function getMedia({
  type,
  page,
}: MediaListQuery): Promise<MediaListResultsEntity[]> {
  const pagenumber: number = page ? page : 1
  let url: string = ''
  switch (type) {
    case 'popular_movie':
      url = `/movie/popular?language=en-US&page=${pagenumber}`
      break
    case 'popular_tv':
      url = `/tv/popular?language=en-US&page=${pagenumber}`
      break
    case 'top_rated_movie':
      url = `/movie/top_rated?language=en-US&page=${pagenumber}`
      break
    case 'top_rated_tv':
      url = `/tv/top_rated?language=en-US&page=${pagenumber}`
      break
    case 'trending_day':
      url = `/trending/all/day?language=en-US&page=${pagenumber}`
      break
    case 'trending_week':
      url = `/trending/all/week?language=en-US&page=${pagenumber}`
      break
    case 'upcoming_movie':
      url = `/movie/upcoming?language=en-US&page=${pagenumber}`
      break
  }

  const result = await Tmdb<MediaListEntity>(url)
  console.log(result, 'result')
  if (result.error) {
    throw new Error(result.error)
  }
  if (!result.data || !result.data.results) {
    throw new Error('No data returned')
  }
  return result.data.results
}

{
  /*

import { MediaEntity, ResultsEntity } from "@/types";

interface Query {
  type:
    | "popular_movie"
    | "popular_tv"
    | "top_rated_movie"
    | "top_rated_tv"
    | "trending_day"
    | "trending_week"
    | "upcoming_movie";
  page?: number;
}

export async function getMedia({
  type,
  page,
}: Query): Promise<ResultsEntity[]> {
  const pagenumber: number = page ? page : 1;
  let url: string = "";
  switch (type) {
    case "popular_movie":
      url = `/movie/popular?language=en-US&page=${pagenumber}`;
      break;
    case "popular_tv":
      url = `/tv/popular?language=en-US&page=${pagenumber}`;
      break;
    case "top_rated_movie":
      url = `/movie/top_rated?language=en-US&page=${pagenumber}`;
      break;
    case "top_rated_tv":
      url = `/tv/top_rated?language=en-US&page=${pagenumber}`;
      break;
    case "trending_day":
      url = `/trending/all/day?language=en-US&page=${pagenumber}`;
      break;
    case "trending_week":
      url = `/trending/all/week?language=en-US&page=${pagenumber}`;
      break;
    case "upcoming_movie":
      url = `/movie/upcoming?language=en-US&page=${pagenumber}`;
      break;
  }

  const result = await Tmdb<MediaEntity>(url);
  console.log(result, "result");
  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.data || !result.data.results) {
    throw new Error("No data returned");
  }
  return result.data.results;
}

*/
}
