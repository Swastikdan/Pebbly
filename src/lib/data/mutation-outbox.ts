import * as v from "valibot";

export const mutationOutboxRecordSchema = v.object({
  id: v.string(),
  userId: v.string(),
  kind: v.string(),
  payload: v.unknown(),
  coalesceKey: v.optional(v.string()),
  createdAt: v.pipe(v.number(), v.finite()),
});

export type MutationOutboxRecord = v.InferOutput<
  typeof mutationOutboxRecordSchema
>;

const STORAGE_KEY = "pebbly-pending-mutations";

function readRecords(): MutationOutboxRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const res = v.safeParse(mutationOutboxRecordSchema, item);
      return res.success ? [res.output] : [];
    });
  } catch {
    return [];
  }
}

function writeRecords(records: MutationOutboxRecord[]) {
  if (typeof window === "undefined") return;
  try {
    if (records.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage can be disabled or full. Optimistic mutations still work; the
    // outbox is a best-effort crash-recovery layer.
  }
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

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
  records.push({
    id,
    userId,
    kind,
    payload,
    ...(coalesceKey ? { coalesceKey } : {}),
    createdAt: Date.now(),
  });
  writeRecords(records);
  return id;
}

export function removeMutation(id: string) {
  writeRecords(readRecords().filter((record) => record.id !== id));
}

export function pendingMutationsFor(userId: string) {
  return readRecords()
    .filter((record) => record.userId === userId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function clearPendingMutations(userId: string) {
  writeRecords(readRecords().filter((record) => record.userId !== userId));
}
