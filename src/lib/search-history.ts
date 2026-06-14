const SEARCH_HISTORY_KEY = "search-history";
const MAX_HISTORY_ITEMS = 8;

export function getSearchHistory(): string[] {
	if (typeof window === "undefined") return [];
	try {
		return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? "[]");
	} catch {
		return [];
	}
}

export function addToSearchHistory(query: string) {
	if (!query.trim()) return;
	const history = getSearchHistory().filter(
		(item) => item.toLowerCase() !== query.trim().toLowerCase(),
	);
	history.unshift(query.trim());
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
