const PRIVATE_LOCAL_KEYS = [
  "watchlist-storage",
  "local-lists-store",
  "local-progress-store",
  "pebbly:guest_taste_profile",
  "pebbly-pending-mutations",
  "pebbly:guest_rec_feedback",
  "pebbly:next_up_snooze",
  "search-history",
  "__lru_timestamps",
];

export function clearPrivateLocalData(): void {
  if (typeof window === "undefined") return;
  for (const key of PRIVATE_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
}
