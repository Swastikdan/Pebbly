export function detectRegion(): string {
  if (typeof window === "undefined") return "US";
  try {
    return new Intl.Locale(navigator.language).region ?? "US";
  } catch {
    return "US";
  }
}
