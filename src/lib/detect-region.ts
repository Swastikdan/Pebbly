export function detectRegion(): string {
  if (typeof window === "undefined") return "US";
  try {
    const region = new Intl.Locale(navigator.language).region;
    return region && /^[A-Z]{2}$/.test(region) ? region : "US";
  } catch {
    return "US";
  }
}
