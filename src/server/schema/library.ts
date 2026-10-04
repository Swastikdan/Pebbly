import * as v from "valibot";

import { mediaTypeSchema, progressStatusSchema } from "./common";

export const getWatchlistActivityArgsSchema = v.object({
  cursor: v.optional(v.pipe(v.string(), v.maxLength(1000))),
  limit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  ),
});
export type GetWatchlistActivityArgs = v.InferOutput<
  typeof getWatchlistActivityArgsSchema
>;

export const undoWatchlistActivityArgsSchema = v.object({
  activityId: v.pipe(v.string(), v.minLength(1)),
});
export type UndoWatchlistActivityArgs = v.InferOutput<
  typeof undoWatchlistActivityArgsSchema
>;

export const getWatchlistSnapshotsArgsSchema = v.object({
  limit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50)),
  ),
});
export type GetWatchlistSnapshotsArgs = v.InferOutput<
  typeof getWatchlistSnapshotsArgsSchema
>;

export const restoreWatchlistSnapshotArgsSchema = v.object({
  snapshotId: v.pipe(v.string(), v.minLength(1)),
});
export type RestoreWatchlistSnapshotArgs = v.InferOutput<
  typeof restoreWatchlistSnapshotArgsSchema
>;

export const exportAccountDataArgsSchema = v.object({
  format: v.optional(v.picklist(["json", "csv"])),
});
export type ExportAccountDataArgs = v.InferOutput<
  typeof exportAccountDataArgsSchema
>;

export const requestAccountDeletionArgsSchema = v.object({
  confirmation: v.literal("DELETE"),
});
export type RequestAccountDeletionArgs = v.InferOutput<
  typeof requestAccountDeletionArgsSchema
>;

export const cancelAccountDeletionArgsSchema = v.object({});
export type CancelAccountDeletionArgs = v.InferOutput<
  typeof cancelAccountDeletionArgsSchema
>;

export const releaseSubscriptionArgsSchema = v.object({
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  mediaType: mediaTypeSchema,
  title: v.optional(v.pipe(v.string(), v.maxLength(500))),
  releaseDate: v.optional(v.pipe(v.string(), v.maxLength(32))),
  region: v.optional(v.pipe(v.string(), v.maxLength(8))),
  notifyRelease: v.optional(v.boolean()),
  notifyAvailability: v.optional(v.boolean()),
});
export type ReleaseSubscriptionArgs = v.InferOutput<
  typeof releaseSubscriptionArgsSchema
>;

export const listNotificationsArgsSchema = v.object({
  limit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  ),
});
export type ListNotificationsArgs = v.InferOutput<
  typeof listNotificationsArgsSchema
>;

export const markNotificationReadArgsSchema = v.object({
  notificationId: v.pipe(v.string(), v.minLength(1)),
});
export type MarkNotificationReadArgs = v.InferOutput<
  typeof markNotificationReadArgsSchema
>;

export const getInsightsArgsSchema = v.object({
  year: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1970), v.maxValue(2200)),
  ),
});
export type GetInsightsArgs = v.InferOutput<typeof getInsightsArgsSchema>;

export const recordWatchSessionArgsSchema = v.object({
  clientEventId: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  mediaType: mediaTypeSchema,
  season: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  episode: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  startedAt: v.pipe(v.number(), v.finite()),
  endedAt: v.pipe(v.number(), v.finite()),
  watchedSeconds: v.pipe(
    v.number(),
    v.finite(),
    v.minValue(0),
    v.maxValue(86_400),
  ),
  progressPercent: v.pipe(
    v.number(),
    v.finite(),
    v.minValue(0),
    v.maxValue(100),
  ),
});
export type RecordWatchSessionArgs = v.InferOutput<
  typeof recordWatchSessionArgsSchema
>;

export const bulkListItemsArgsSchema = v.object({
  listId: v.pipe(v.string(), v.minLength(1)),
  items: v.pipe(
    v.array(
      v.object({
        tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
        mediaType: mediaTypeSchema,
      }),
    ),
    v.maxLength(500),
  ),
  action: v.picklist(["remove", "move", "status"]),
  targetListId: v.optional(v.pipe(v.string(), v.minLength(1))),
  progressStatus: v.optional(progressStatusSchema),
});
export type BulkListItemsArgs = v.InferOutput<typeof bulkListItemsArgsSchema>;
