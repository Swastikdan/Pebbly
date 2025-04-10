export interface WatchList {
  title: string;
  type: "movie" | "tv";
  externalId: string;
  image?: string;
  rating?: number;
  releaseDate?: string;
}

export type NullableWatchList = WatchList | null;
