import * as v from "valibot";

import type { MutationOutboxRecord } from "@/lib/data/mutation-outbox";
import {
  discardMutation,
  getMutationOutboxSnapshot,
  markMutationFailed,
  markMutationInvalid,
  markMutationRecovered,
  markMutationSyncing,
  MutationOutboxInvalidError,
  pendingMutationsFor,
  retryFailedMutations,
  retryMutation,
} from "@/lib/data/mutation-outbox";
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

export type MutationSyncResult = {
  attempted: number;
  recovered: number;
  failed: number;
  blocked: number;
  offline: boolean;
};

export type MutationSyncRunner = (
  record: MutationOutboxRecord,
) => Promise<unknown>;

export type MutationSyncOptions = {
  run?: MutationSyncRunner;
  isOnline?: () => boolean;
};

type RemoteOperation = () => Promise<unknown>;

function operationForRecord(
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

export function validateMutationRecord(record: MutationOutboxRecord) {
  if (operationForRecord(record)) return undefined;
  return `The saved ${record.kind} change is invalid or no longer supported.`;
}

export async function runRemoteMutation(record: MutationOutboxRecord) {
  const operation = operationForRecord(record);
  if (!operation) {
    throw new MutationOutboxInvalidError(
      `The saved ${record.kind} change is invalid or no longer supported.`,
    );
  }
  await operation();
}

const activeSyncs = new Map<string, Promise<MutationSyncResult>>();

function canSync(isOnline?: () => boolean) {
  if (isOnline) {
    try {
      return isOnline();
    } catch {
      return false;
    }
  }
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

async function runSync(
  userId: string,
  options: MutationSyncOptions,
): Promise<MutationSyncResult> {
  const result: MutationSyncResult = {
    attempted: 0,
    recovered: 0,
    failed: 0,
    blocked: 0,
    offline: false,
  };
  if (!canSync(options.isOnline)) {
    result.offline = true;
    return result;
  }

  for (const record of pendingMutationsFor(userId)) {
    if (record.state === "failed" && record.failure?.kind === "permanent") {
      result.blocked += 1;
      continue;
    }

    const invalidMessage = validateMutationRecord(record);
    if (invalidMessage) {
      markMutationInvalid(record.id, invalidMessage);
      result.failed += 1;
      continue;
    }

    if (!markMutationSyncing(record.id)) continue;
    result.attempted += 1;
    try {
      await (options.run ?? runRemoteMutation)(record);
      markMutationRecovered(record.id);
      result.recovered += 1;
    } catch (error) {
      markMutationFailed(record.id, error);
      result.failed += 1;
      const failure = getMutationOutboxSnapshot(userId).records.find(
        (candidate) => candidate.id === record.id,
      )?.failure;
      if (failure?.kind !== "permanent") break;
    }
  }
  return result;
}

export function syncMutationOutbox(
  userId: string,
  options: MutationSyncOptions = {},
): Promise<MutationSyncResult> {
  const current = activeSyncs.get(userId);
  if (current) return current;

  const promise = runSync(userId, options);
  activeSyncs.set(userId, promise);
  const clear = () => {
    if (activeSyncs.get(userId) === promise) activeSyncs.delete(userId);
  };
  void promise.then(clear, clear);
  return promise;
}

export const processMutationOutbox = syncMutationOutbox;

export function createSyncCenter(
  userId: string,
  options: MutationSyncOptions = {},
) {
  return {
    getSnapshot: () => getMutationOutboxSnapshot(userId),
    sync: () => syncMutationOutbox(userId, options),
    retry: (id?: string) => {
      if (id) retryMutation(id, userId);
      else retryFailedMutations(userId);
      return syncMutationOutbox(userId, options);
    },
    discard: (id: string) => {
      discardMutation(id, userId);
      return getMutationOutboxSnapshot(userId);
    },
  };
}
