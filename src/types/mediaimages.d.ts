export interface MediaImages {
  backdrops?: BackdropsEntityOrLogosEntityOrPostersEntity[] | null;
  id: number;
  logos?: BackdropsEntityOrLogosEntityOrPostersEntity[] | null;
  posters?: BackdropsEntityOrLogosEntityOrPostersEntity[] | null;
}
export interface BackdropsEntityOrLogosEntityOrPostersEntity {
  aspect_ratio: number;
  height: number;
  iso_639_1?: string | null;
  file_path: string;
  vote_average: number;
  vote_count: number;
  width: number;
}
