import * as v from "valibot";

import type { ImportItem, WatchedEpisode } from "@/server/schema/import";
import { normalizeProgressStatus } from "@/lib/utils";
import {
  IMPORT_BATCH_SIZE,
  importWatchlistArgsSchema,
  MAX_WATCHED_EPISODES,
} from "@/server/schema/import";

type RawImportItem = {
  title?: unknown;
  name?: unknown;
  external_id?: unknown;
  id?: unknown;
  tmdbId?: unknown;
  type?: unknown;
  media_type?: unknown;
  mediaType?: unknown;
  image?: unknown;
  poster_path?: unknown;
  rating?: unknown;
  vote_average?: unknown;
  release_date?: unknown;
  releaseDate?: unknown;
  first_air_date?: unknown;
  overview?: unknown;
  inWatchlist?: unknown;
  progressStatus?: unknown;
  status?: unknown;
  progress?: unknown;
  reaction?: unknown;
  watchedEpisodes?: unknown;
};

export type ParsedImport =
  | { ok: false; message: string }
  | {
      ok: true;
      items: ImportItem[];
      watchedEpisodes: WatchedEpisode[];
      /** Items skipped because they were not usable; reported to the user. */
      invalidItemCount: number;
    };

/**
 * Parse and normalize a raw watchlist export (the JSON text of a file)
 * into server-shaped items plus per-title watched episodes. Structural
 * problems come back as `{ ok: false, message }` ready for display; broken
 * individual items are skipped and counted rather than failing the import.
 */
export function parseWatchlistImport(content: string): ParsedImport {
  if (!content || content.trim().length === 0) {
    return { ok: false, message: "The selected file is empty." };
  }

  let importedData: unknown;
  try {
    importedData = JSON.parse(content);
  } catch {
    return {
      ok: false,
      message:
        "Invalid JSON format: Unable to parse file content. Please check the file for syntax errors.",
    };
  }

  if (!Array.isArray(importedData)) {
    return {
      ok: false,
      message:
        "Invalid file structure: Expected a JSON array of items at the root level.",
    };
  }

  if (importedData.length === 0) {
    return {
      ok: false,
      message: "The uploaded JSON array is empty. No items found to import.",
    };
  }

  let invalidItemCount = 0;
  const validationErrors: string[] = [];
  const items: ImportItem[] = [];
  const watchedEpisodes: WatchedEpisode[] = [];

  importedData.forEach((rawEntry, i) => {
    const raw = rawEntry as RawImportItem;
    if (typeof raw !== "object" || raw === null) {
      invalidItemCount++;
      validationErrors.push(`Item #${i + 1}: Not a valid JSON object.`);
      return;
    }

    const rawTitle = raw.title ?? raw.name;
    if (typeof rawTitle !== "string" || rawTitle.trim() === "") {
      invalidItemCount++;
      validationErrors.push(`Item #${i + 1}: Missing title name.`);
      return;
    }
    const title = rawTitle.trim();

    const rawId = raw.external_id ?? raw.tmdbId ?? raw.id;
    const tmdbId = Number(rawId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      invalidItemCount++;
      validationErrors.push(
        `Item #${i + 1} ("${title}"): Invalid TMDB ID (${String(rawId)}).`,
      );
      return;
    }

    const rawType = raw.type ?? raw.mediaType ?? raw.media_type;
    const mediaType = rawType === "tv" || rawType === "movie" ? rawType : null;
    if (!mediaType) {
      invalidItemCount++;
      validationErrors.push(
        `Item #${i + 1} ("${title}"): Invalid media type (${String(rawType)}). Must be "tv" or "movie".`,
      );
      return;
    }

    const rawImage = raw.image ?? raw.poster_path;
    const image =
      typeof rawImage === "string" && rawImage.trim() !== ""
        ? rawImage.trim()
        : null;

    const rawRating = raw.rating ?? raw.vote_average;
    const rating =
      typeof rawRating === "number" && !Number.isNaN(rawRating)
        ? Math.min(Math.max(rawRating, 0), 10)
        : null;

    const rawDate = raw.release_date ?? raw.releaseDate ?? raw.first_air_date;
    const release_date =
      typeof rawDate === "string" && rawDate.trim() !== ""
        ? rawDate.trim()
        : null;

    const overview =
      typeof raw.overview === "string" && raw.overview.trim() !== ""
        ? raw.overview.trim()
        : null;

    const inWatchlist =
      raw.inWatchlist !== undefined && raw.inWatchlist !== null
        ? Boolean(raw.inWatchlist)
        : true;

    const rawStatus = raw.progressStatus ?? raw.status;
    const progressStatus =
      normalizeProgressStatus(
        typeof rawStatus === "string" ? rawStatus : undefined,
      ) ?? "watch-later";

    const rawProgress = raw.progress;
    const progress =
      typeof rawProgress === "number" && !Number.isNaN(rawProgress)
        ? Math.min(Math.max(rawProgress, 0), 100)
        : null;

    const rawReaction = raw.reaction;
    const reaction =
      typeof rawReaction === "string" && rawReaction.trim() !== ""
        ? rawReaction.trim()
        : null;

    items.push({
      tmdbId,
      mediaType,
      title,
      image,
      rating,
      release_date,
      overview,
      inWatchlist,
      progressStatus,
      progress,
      reaction,
    });

    if (
      mediaType === "tv" &&
      raw.watchedEpisodes &&
      typeof raw.watchedEpisodes === "object"
    ) {
      for (const [key, isWatched] of Object.entries(
        raw.watchedEpisodes as Record<string, unknown>,
      )) {
        if (!isWatched) continue;
        const [seasonStr, episodeStr] = key.split(":");
        const season = Number.parseInt(seasonStr, 10);
        const episode = Number.parseInt(episodeStr, 10);

        if (!Number.isNaN(season) && !Number.isNaN(episode)) {
          watchedEpisodes.push({ tmdbId, season, episode });
        }
      }
    }
  });

  if (items.length === 0) {
    const sampleErrors = validationErrors.slice(0, 3).join(" ");
    return {
      ok: false,
      message: `No valid items found in the watchlist file. ${sampleErrors}`,
    };
  }

  return { ok: true, items, watchedEpisodes, invalidItemCount };
}

export interface ImportBatch {
  items: ImportItem[];
  watchedEpisodes: WatchedEpisode[];
  final: boolean;
}

/**
 * Group items into server payloads that each satisfy BOTH server limits
 * (items <= IMPORT_BATCH_SIZE, episodes <= MAX_WATCHED_EPISODES). Episodes
 * travel only with a batch containing their title, since the server applies
 * a batch's episodes just for titles present in that same batch. Batches are
 * grouped greedily per title instead of a fixed item slice.
 *
 * Throws when a single title carries more episodes than MAX_WATCHED_EPISODES:
 * such a payload can never fit any batch, so planning must fail up front.
 */
export function planImportBatches(
  items: ImportItem[],
  watchedEpisodes: WatchedEpisode[],
): ImportBatch[] {
  const episodesByTvId = new Map<number, WatchedEpisode[]>();
  for (const episode of watchedEpisodes) {
    const list = episodesByTvId.get(episode.tmdbId);
    if (list) list.push(episode);
    else episodesByTvId.set(episode.tmdbId, [episode]);
  }

  const batches: ImportBatch[] = [];
  let cursor = 0;
  while (cursor < items.length) {
    const batchItems: ImportItem[] = [];
    const batchTvIds = new Set<number>();
    let batchEpisodeCount = 0;

    while (cursor < items.length && batchItems.length < IMPORT_BATCH_SIZE) {
      const candidate = items[cursor];
      const candidateEpisodes =
        episodesByTvId.get(candidate.tmdbId)?.length ?? 0;

      if (candidateEpisodes > MAX_WATCHED_EPISODES) {
        throw new Error(
          `"${candidate.title}" has ${candidateEpisodes} watched ` +
            `episodes, exceeding the maximum of ${MAX_WATCHED_EPISODES} ` +
            "per import batch. Remove some entries and retry.",
        );
      }

      if (
        batchItems.length > 0 &&
        batchEpisodeCount + candidateEpisodes > MAX_WATCHED_EPISODES
      ) {
        break;
      }

      batchItems.push(candidate);
      batchTvIds.add(candidate.tmdbId);
      batchEpisodeCount += candidateEpisodes;
      cursor++;
    }

    batches.push({
      items: batchItems,
      watchedEpisodes: watchedEpisodes.filter((ep) =>
        batchTvIds.has(ep.tmdbId),
      ),
      final: cursor >= items.length,
    });
  }

  for (const batch of batches) {
    const result = v.safeParse(importWatchlistArgsSchema, batch);
    if (!result.success) {
      const firstIssue = result.issues[0];
      const issuePath = firstIssue.path?.map((p) => p.key).join(".") ?? "root";
      throw new Error(
        `Validation error in ${issuePath}: ${firstIssue.message}`,
      );
    }
  }

  return batches;
}
