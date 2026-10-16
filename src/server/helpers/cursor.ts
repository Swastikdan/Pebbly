export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor<T>(
  value: string | null | undefined,
  guard: (parsed: unknown) => T | null,
): T | null {
  if (!value) return null;
  for (const encoding of ["base64url", "base64"] as const) {
    try {
      const parsed = JSON.parse(
        Buffer.from(value, encoding).toString("utf8"),
      ) as unknown;
      const guarded = guard(parsed);
      if (guarded) return guarded;
    } catch {
      // try next encoding
    }
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function activityCursorGuard(v: unknown) {
  if (
    !isRecord(v) ||
    typeof v.createdAt !== "number" ||
    typeof v.id !== "string"
  )
    return null;
  return { createdAt: v.createdAt, id: v.id };
}

export function watchlistCursorGuard(v: unknown) {
  if (!isRecord(v)) return null;
  const { value, id } = v;
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    typeof id !== "string"
  )
    return null;
  return { value, id } as { value: string | number; id: string };
}

export function collectionCursorGuard(v: unknown) {
  if (!isRecord(v)) return null;
  const { position, addedAt, id } = v;
  if (
    typeof position !== "number" ||
    typeof addedAt !== "number" ||
    typeof id !== "string"
  )
    return null;
  return { position, addedAt, id };
}
