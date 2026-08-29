export function mergeDefinedFields<T extends object>(
  row: T,
  patch: Partial<T>,
): T {
  const merged = { ...row };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}
