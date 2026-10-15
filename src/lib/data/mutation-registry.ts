import * as v from "valibot";

import type { MutationOutboxRecord } from "@/lib/data/mutation-outbox";
import { MutationOutboxInvalidError } from "@/lib/data/mutation-outbox";
import {
  markEpisodeWatched,
  markSeasonEpisodesWatched,
  markShowEpisodesAndStatus,
  removeFromContinueWatching,
  setProgressStatus,
  setReaction,
  setWatchlistMembership,
  updateProgress,
} from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import {
  markEpisodeWatchedArgsSchema,
  markSeasonEpisodesWatchedArgsSchema,
  markShowEpisodesAndStatusArgsSchema,
  mediaIdentityArgsSchema,
  setProgressStatusArgsSchema,
  setReactionArgsSchema,
  setWatchlistMembershipArgsSchema,
  updateProgressArgsSchema,
} from "@/server/schema/watchlist";

/**
 * The single source of truth mapping a persisted outbox `kind` to the remote
 * write that replays it.
 *
 * Every mutating path funnels its payload through here (via `enqueueMutation`'s
 * `kind`, `validateMutationRecord`, and `runRemoteMutation`), so a new mutation
 * kind is one entry in one switch — not a parallel edit in each consumer. The
 * schemas are shared with the server fns, so a payload that no longer validates
 * is reported as a permanent (invalid) record instead of being retried forever.
 */
export const MUTATION_KINDS = [
  "set-membership",
  "set-progress-status",
  "set-reaction",
  "mark-episode",
  "mark-season",
  "mark-show",
  "mark-show-episodes",
  "update-progress",
  "remove-continue-watching",
] as const;

export type MutationKind = (typeof MUTATION_KINDS)[number];

/** A replayable remote write, or `undefined` when the record is not actionable. */
export type RemoteOperation = () => Promise<unknown>;

/**
 * Resolves the remote operation for a record, validating and parsing its
 * persisted payload first. Returns `undefined` for an unknown kind or a payload
 * that no longer matches its schema (both treated as permanently invalid so
 * they cannot block newer mutations).
 */
export function operationFor(
  record: MutationOutboxRecord,
): RemoteOperation | undefined {
  switch (record.kind) {
    case "set-membership": {
      const parsed = v.safeParse(
        setWatchlistMembershipArgsSchema,
        record.payload,
      );
      return parsed.success
        ? () => unwrap(setWatchlistMembership({ data: parsed.output }))
        : undefined;
    }
    case "set-progress-status": {
      const parsed = v.safeParse(setProgressStatusArgsSchema, record.payload);
      return parsed.success
        ? () => unwrap(setProgressStatus({ data: parsed.output }))
        : undefined;
    }
    case "set-reaction": {
      const parsed = v.safeParse(setReactionArgsSchema, record.payload);
      return parsed.success
        ? () => unwrap(setReaction({ data: parsed.output }))
        : undefined;
    }
    case "mark-episode": {
      const parsed = v.safeParse(markEpisodeWatchedArgsSchema, record.payload);
      return parsed.success
        ? () => unwrap(markEpisodeWatched({ data: parsed.output }))
        : undefined;
    }
    case "mark-season": {
      const parsed = v.safeParse(
        markSeasonEpisodesWatchedArgsSchema,
        record.payload,
      );
      return parsed.success
        ? () => unwrap(markSeasonEpisodesWatched({ data: parsed.output }))
        : undefined;
    }
    case "mark-show":
    case "mark-show-episodes": {
      const parsed = v.safeParse(
        markShowEpisodesAndStatusArgsSchema,
        record.payload,
      );
      return parsed.success
        ? () => unwrap(markShowEpisodesAndStatus({ data: parsed.output }))
        : undefined;
    }
    case "update-progress": {
      const parsed = v.safeParse(updateProgressArgsSchema, record.payload);
      return parsed.success
        ? () => unwrap(updateProgress({ data: parsed.output }))
        : undefined;
    }
    case "remove-continue-watching": {
      const parsed = v.safeParse(mediaIdentityArgsSchema, record.payload);
      return parsed.success
        ? () => unwrap(removeFromContinueWatching({ data: parsed.output }))
        : undefined;
    }
    default:
      return undefined;
  }
}

function invalidMessageFor(record: MutationOutboxRecord): string {
  return `The saved ${record.kind} change is invalid or no longer supported.`;
}

/** `undefined` when replayable, otherwise a permanent-invalidity reason. */
export function validateMutationRecord(record: MutationOutboxRecord) {
  if (operationFor(record)) return undefined;
  return invalidMessageFor(record);
}

export async function runRemoteMutation(record: MutationOutboxRecord) {
  const operation = operationFor(record);
  if (!operation) {
    throw new MutationOutboxInvalidError(invalidMessageFor(record));
  }
  await operation();
}
