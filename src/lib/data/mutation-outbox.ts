import * as v from "valibot";

export const MUTATION_OUTBOX_STATES = [
  "pending",
  "syncing",
  "failed",
  "recovered",
] as const;
export type MutationOutboxState = (typeof MUTATION_OUTBOX_STATES)[number];

export const MUTATION_OUTBOX_FAILURE_KINDS = [
  "transient",
  "permanent",
] as const;
export type MutationOutboxFailureKind =
  (typeof MUTATION_OUTBOX_FAILURE_KINDS)[number];

export const mutationOutboxStateSchema = v.picklist(MUTATION_OUTBOX_STATES);
export const mutationOutboxFailureKindSchema = v.picklist(
  MUTATION_OUTBOX_FAILURE_KINDS,
);

export const mutationOutboxFailureSchema = v.object({
  kind: mutationOutboxFailureKindSchema,
  message: v.string(),
  at: v.pipe(v.number(), v.finite()),
  status: v.optional(v.pipe(v.number(), v.integer())),
  code: v.optional(v.string()),
});

export type MutationOutboxFailure = v.InferOutput<
  typeof mutationOutboxFailureSchema
>;

export const mutationOutboxRecordSchema = v.object({
  id: v.string(),
  userId: v.string(),
  kind: v.string(),
  payload: v.unknown(),
  coalesceKey: v.optional(v.string()),
  createdAt: v.pipe(v.number(), v.finite()),
  state: v.optional(mutationOutboxStateSchema),
  status: v.optional(mutationOutboxStateSchema),
  attempts: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  updatedAt: v.optional(v.pipe(v.number(), v.finite())),
  recoveredAt: v.optional(v.pipe(v.number(), v.finite())),
  failure: v.optional(mutationOutboxFailureSchema),
});

type PersistedMutationOutboxRecord = v.InferOutput<
  typeof mutationOutboxRecordSchema
>;

export type MutationOutboxRecord = Omit<
  PersistedMutationOutboxRecord,
  "state" | "attempts" | "updatedAt" | "recoveredAt"
> & {
  state: MutationOutboxState;
  attempts: number;
  updatedAt?: number;
  recoveredAt?: number;
};

export type MutationOutboxSnapshot = {
  records: MutationOutboxRecord[];
  pending: number;
  syncing: number;
  failed: number;
  recovered: number;
  permanent: number;
  total: number;
};

export type MutationFailureOptions =
  | boolean
  | {
      permanent?: boolean;
      kind?: MutationOutboxFailureKind;
    };

export const MUTATION_OUTBOX_STORAGE_KEY = "pebbly-pending-mutations";
const RECOVERED_STORAGE_LIMIT = 20;
const listeners = new Set<() => void>();

function stateOf(record: {
  state?: MutationOutboxState;
  status?: MutationOutboxState;
}): MutationOutboxState {
  return record.state ?? record.status ?? "pending";
}

function normalizeRecord(
  record: PersistedMutationOutboxRecord,
): MutationOutboxRecord {
  return {
    ...record,
    state: stateOf(record),
    attempts: record.attempts ?? 0,
    updatedAt: record.updatedAt ?? record.createdAt,
  };
}

function chronological(records: MutationOutboxRecord[]) {
  return records
    .map((record, index) => ({ record, index }))
    .sort(
      (a, b) => a.record.createdAt - b.record.createdAt || a.index - b.index,
    )
    .map(({ record }) => record);
}

function pruneRecovered(records: MutationOutboxRecord[]) {
  const recovered = records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.state === "recovered")
    .sort(
      (a, b) =>
        (b.record.recoveredAt ?? b.record.updatedAt ?? b.record.createdAt) -
          (a.record.recoveredAt ?? a.record.updatedAt ?? a.record.createdAt) ||
        b.index - a.index,
    )
    .slice(0, RECOVERED_STORAGE_LIMIT)
    .map(({ record }) => record);
  const recoveredIds = new Set(recovered.map((record) => record.id));
  return records.filter(
    (record) => record.state !== "recovered" || recoveredIds.has(record.id),
  );
}

function readRecords(): MutationOutboxRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MUTATION_OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const res = v.safeParse(mutationOutboxRecordSchema, item);
      return res.success ? [normalizeRecord(res.output)] : [];
    });
  } catch {
    return [];
  }
}

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {}
  }
}

function writeRecords(records: MutationOutboxRecord[]) {
  const next = chronological(pruneRecovered(records));
  if (typeof window !== "undefined") {
    try {
      if (next.length === 0) {
        window.localStorage.removeItem(MUTATION_OUTBOX_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          MUTATION_OUTBOX_STORAGE_KEY,
          JSON.stringify(next),
        );
      }
    } catch {
      return;
    }
  }
  notify();
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function messageOf(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 500);
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim().slice(0, 500);
  }
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim().slice(0, 500);
    }
  }
  return "The change could not be synced.";
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  if (
    typeof candidate.status === "number" &&
    Number.isInteger(candidate.status)
  ) {
    return candidate.status;
  }
  if (
    candidate.response &&
    typeof candidate.response.status === "number" &&
    Number.isInteger(candidate.response.status)
  ) {
    return candidate.response.status;
  }
  return undefined;
}

function codeOf(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function hasPermanentMarker(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { permanent?: unknown }).permanent === true
  );
}

function isPermanentCode(code: string | undefined) {
  return (
    code === "INVALID_RECORD" ||
    code === "BAD_REQUEST" ||
    code === "UNAUTHORIZED" ||
    code === "FORBIDDEN" ||
    code === "NOT_FOUND" ||
    code === "CONFLICT"
  );
}

function isPermanentStatus(status: number | undefined) {
  return (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 425 &&
    status !== 429
  );
}

export class MutationOutboxInvalidError extends Error {
  readonly permanent = true;
  readonly code = "INVALID_RECORD";

  constructor(message = "This saved change is no longer valid.") {
    super(message);
    this.name = "MutationOutboxInvalidError";
  }
}

export function classifyMutationError(
  error: unknown,
  options: MutationFailureOptions = {},
): MutationOutboxFailure {
  const explicitKind =
    typeof options === "boolean"
      ? options
        ? "permanent"
        : undefined
      : options.kind;
  const explicitPermanent =
    typeof options === "boolean" ? options : options.permanent === true;
  const status = statusOf(error);
  const code = codeOf(error);
  const permanent =
    explicitKind === "permanent" ||
    explicitPermanent ||
    hasPermanentMarker(error) ||
    error instanceof MutationOutboxInvalidError ||
    isPermanentCode(code) ||
    isPermanentStatus(status);
  const kind = permanent ? "permanent" : (explicitKind ?? "transient");
  return {
    kind,
    message: messageOf(error),
    at: Date.now(),
    ...(status === undefined ? {} : { status }),
    ...(code === undefined ? {} : { code }),
  };
}

export const classifyMutationFailure = classifyMutationError;

export function enqueueMutation(
  userId: string,
  kind: string,
  payload: unknown,
  coalesceKey?: string,
): string {
  const id = newId();
  const records = readRecords().filter(
    (record) =>
      !coalesceKey ||
      record.userId !== userId ||
      record.kind !== kind ||
      record.coalesceKey !== coalesceKey,
  );
  const now = Date.now();
  records.push({
    id,
    userId,
    kind,
    payload,
    ...(coalesceKey ? { coalesceKey } : {}),
    createdAt: now,
    state: "pending",
    status: "pending",
    attempts: 0,
    updatedAt: now,
  });
  writeRecords(records);
  return id;
}

export function removeMutation(id: string, userId?: string) {
  writeRecords(
    readRecords().filter(
      (record) =>
        record.id !== id || (userId !== undefined && record.userId !== userId),
    ),
  );
}

export function discardMutation(id: string, userId?: string) {
  removeMutation(id, userId);
}

export function allMutationRecordsFor(userId: string) {
  return chronological(
    readRecords().filter((record) => record.userId === userId),
  );
}

export function pendingMutationsFor(userId: string) {
  return allMutationRecordsFor(userId).filter(
    (record) => record.state !== "recovered",
  );
}

export function clearPendingMutations(userId: string) {
  writeRecords(readRecords().filter((record) => record.userId !== userId));
}

export function getMutationOutboxSnapshot(
  userId?: string,
): MutationOutboxSnapshot {
  const records = userId
    ? allMutationRecordsFor(userId)
    : chronological(readRecords());
  const pending = records.filter((record) => record.state === "pending").length;
  const syncing = records.filter((record) => record.state === "syncing").length;
  const failedRecords = records.filter((record) => record.state === "failed");
  const failed = failedRecords.length;
  const permanent = failedRecords.filter(
    (record) => record.failure?.kind === "permanent",
  ).length;
  const recovered = records.filter(
    (record) => record.state === "recovered",
  ).length;
  return {
    records,
    pending,
    syncing,
    failed,
    recovered,
    permanent,
    total: records.length,
  };
}

export function markMutationSyncing(id: string) {
  const records = readRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1 || stateOf(records[index]) === "recovered") return false;
  const record = records[index];
  records[index] = {
    ...record,
    state: "syncing",
    status: "syncing",
    attempts: record.attempts + 1,
    updatedAt: Date.now(),
    failure: undefined,
  };
  writeRecords(records);
  return true;
}

export function markMutationFailed(
  id: string,
  error: unknown,
  options: MutationFailureOptions = {},
) {
  const records = readRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1 || stateOf(records[index]) === "recovered") return false;
  const failure = classifyMutationError(error, options);
  records[index] = {
    ...records[index],
    state: "failed",
    status: "failed",
    updatedAt: Date.now(),
    failure,
  };
  writeRecords(records);
  return true;
}

export function markMutationInvalid(id: string, message?: string) {
  return markMutationFailed(id, new MutationOutboxInvalidError(message));
}

export function markMutationRecovered(id: string) {
  const records = readRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return false;
  const now = Date.now();
  records[index] = {
    ...records[index],
    state: "recovered",
    status: "recovered",
    updatedAt: now,
    recoveredAt: now,
    failure: undefined,
  };
  writeRecords(records);
  return true;
}

export function retryMutation(id: string, userId?: string) {
  const records = readRecords();
  const index = records.findIndex(
    (record) =>
      record.id === id && (userId === undefined || record.userId === userId),
  );
  if (index === -1) return false;
  records[index] = {
    ...records[index],
    state: "pending",
    status: "pending",
    updatedAt: Date.now(),
    failure: undefined,
  };
  writeRecords(records);
  return true;
}

export function retryFailedMutations(userId: string) {
  const records = readRecords();
  const now = Date.now();
  let changed = false;
  const next = records.map((record) => {
    if (record.userId !== userId || record.state !== "failed") return record;
    changed = true;
    return {
      ...record,
      state: "pending" as const,
      status: "pending" as const,
      updatedAt: now,
      failure: undefined,
    };
  });
  if (changed) writeRecords(next);
  return changed;
}

export function subscribeToMutationOutbox(listener: () => void) {
  listeners.add(listener);
  let storageListener: ((event: StorageEvent) => void) | undefined;
  if (
    typeof window !== "undefined" &&
    typeof window.addEventListener === "function"
  ) {
    storageListener = (event) => {
      if (event.key === MUTATION_OUTBOX_STORAGE_KEY) listener();
    };
    window.addEventListener("storage", storageListener);
  }
  return () => {
    listeners.delete(listener);
    if (storageListener && typeof window !== "undefined") {
      window.removeEventListener("storage", storageListener);
    }
  };
}

export const subscribeToOutbox = subscribeToMutationOutbox;
