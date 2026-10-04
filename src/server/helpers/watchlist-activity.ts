import type { Db } from "../db/client";
import type { watchItems } from "../db/schema";
import type { MediaType, ProgressStatus, Reaction } from "../schema/common";
import { watchlistActivity } from "../db/schema";

type WatchItemRow = typeof watchItems.$inferSelect;

function changed<T>(before: T | null | undefined, after: T | null | undefined) {
  return (before ?? null) !== (after ?? null);
}

export async function recordWatchlistActivity(
  db: Db,
  userId: string,
  identity: { tmdbId: number; mediaType: MediaType },
  before: WatchItemRow | null | undefined,
  after: WatchItemRow | null | undefined,
): Promise<void> {
  if (!before && !after) return;

  const previousStatus = before?.progressStatus ?? null;
  const nextStatus = after?.progressStatus ?? null;
  const previousReaction = before?.reaction ?? null;
  const nextReaction = after?.reaction ?? null;
  const previousProgress = before?.progress ?? null;
  const nextProgress = after?.progress ?? null;
  const added = !before?.inWatchlist && Boolean(after?.inWatchlist);
  const removed = Boolean(before?.inWatchlist) && !after?.inWatchlist;
  const statusChanged = changed(previousStatus, nextStatus);
  const reactionChanged = changed(previousReaction, nextReaction);
  const progressChanged = changed(previousProgress, nextProgress);

  if (
    !added &&
    !removed &&
    !statusChanged &&
    !reactionChanged &&
    !progressChanged
  ) {
    return;
  }

  const action = added
    ? ("added" as const)
    : removed
      ? ("removed" as const)
      : nextStatus === "done" && statusChanged
        ? ("watched" as const)
        : reactionChanged
          ? ("rated" as const)
          : statusChanged
            ? ("status_changed" as const)
            : ("status_changed" as const);

  await db.insert(watchlistActivity).values({
    id: crypto.randomUUID(),
    userId,
    tmdbId: identity.tmdbId,
    mediaType: identity.mediaType,
    action,
    title: after?.title ?? before?.title ?? null,
    image: after?.image ?? before?.image ?? null,
    rating: after?.rating ?? before?.rating ?? null,
    releaseDate: after?.releaseDate ?? before?.releaseDate ?? null,
    overview: after?.overview ?? before?.overview ?? null,
    previousStatus: previousStatus as ProgressStatus | null,
    nextStatus: nextStatus as ProgressStatus | null,
    previousReaction: previousReaction as Reaction | null,
    nextReaction: nextReaction as Reaction | null,
    previousProgress,
    nextProgress,
    createdAt: Date.now(),
  });
}
