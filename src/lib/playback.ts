import type { MediaType } from "@/domain/watchlist";

export function resolvePlaybackMode(
  preview: boolean,
  external: boolean,
  externalUrl?: string,
) {
  if (preview) return "iframe";
  if (external && externalUrl) return "redirect";
  return null;
}

export function buildVidyUrl(
  id: number,
  type: MediaType,
  season = 1,
  episode = 1,
  color = "FFFFFF",
) {
  const path =
    type === "movie" ? `movie/${id}` : `tv/${id}/${season}/${episode}`;
  const params = new URLSearchParams({ color, autoplay: "true" });
  if (type === "tv") {
    params.set("nextEpisode", "true");
    params.set("episodeSelector", "true");
    params.set("autoplayNextEpisode", "true");
  }
  return `https://www.vidy.st/${path}?${params}`;
}
