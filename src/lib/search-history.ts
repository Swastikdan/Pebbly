const SEARCH_HISTORY_KEY = "search-history";
const MAX_HISTORY_ITEMS = 8;

/**
 * Reads and shape-checks the persisted search history. A corrupted value
 * (non-array or non-string entries, e.g. from a pre-release build) degrades
 * to an empty history and resets the key instead of crashing `.filter`.
 */
export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
      return [];
    }
    const entries = parsed.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (entries.length !== parsed.length) {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries));
    }
    return entries;
  } catch {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    return [];
  }
}

export function addToSearchHistory(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  const history = getSearchHistory().filter(
    (item) => item.toLowerCase() !== trimmed.toLowerCase(),
  );
  history.unshift(trimmed);
  localStorage.setItem(
    SEARCH_HISTORY_KEY,
    JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)),
  );
}

export function removeFromSearchHistory(query: string) {
  const history = getSearchHistory().filter((item) => item !== query);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

export function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}
