import type { OpHandle } from "@/lib/data/pending-ops";
import type { QueryClient } from "@tanstack/react-query";
import { enqueueMutation, removeMutation } from "@/lib/data/mutation-outbox";
import { scheduleSync } from "@/lib/data/pending-ops";
import { logError } from "@/lib/utils";

export type MutationOutbox = {
  userId: string;
  kind: string;
  payload: unknown;
};

export type MutationOptions<T> = {
  begin: () => OpHandle | undefined;
  run: () => Promise<T>;
  syncKeys: readonly (readonly unknown[])[];
  errorMessage: string;
  onSuccess?: (result: T) => void;
  outbox?: MutationOutbox;
};

export async function runMutationAsync<T = unknown>(
  queryClient: QueryClient,
  { begin, run, syncKeys, errorMessage, onSuccess, outbox }: MutationOptions<T>,
): Promise<T> {
  const handle = begin();
  const outboxId = outbox
    ? enqueueMutation(outbox.userId, outbox.kind, outbox.payload)
    : undefined;
  try {
    const result = await run();
    onSuccess?.(result);
    handle?.resolve();
    if (outboxId) removeMutation(outboxId);
    return result;
  } catch (error) {
    logError(errorMessage, error);
    handle?.remove();
    throw error;
  } finally {
    scheduleSync(queryClient, syncKeys);
  }
}
