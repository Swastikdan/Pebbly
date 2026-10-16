import type { MutationOutboxRecord } from "@/lib/data/mutation-outbox";
import {
  discardMutation,
  getMutationOutboxSnapshot,
  markMutationFailed,
  markMutationInvalid,
  markMutationRecovered,
  markMutationSyncing,
  pendingMutationsFor,
  retryFailedMutations,
  retryMutation,
} from "@/lib/data/mutation-outbox";
import {
  runRemoteMutation,
  validateMutationRecord,
} from "@/lib/data/mutation-registry";

// Re-exported so existing consumers keep importing the replay surface from the
// sync center; the mapping itself lives in one place (`mutation-registry`).
export { runRemoteMutation, validateMutationRecord };

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
