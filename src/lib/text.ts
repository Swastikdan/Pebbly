export function normalizeTitleKey(title?: string | null): string {
  return (title ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return hash;
}
