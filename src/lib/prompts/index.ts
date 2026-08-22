// Pure prompt-building helpers for the recommendation engine. Kept dependency-free
// (no server imports) so they are trivially testable and reusable anywhere.

export interface WatchItemSummary {
	tmdbId: number;
	mediaType: "movie" | "tv";
	title: string | null;
	rating: number | null;
	progressStatus: string | null;
	reaction: string | null;
	progress: number | null;
}

export interface CustomListSummary {
	_id: string;
	name: string;
}

export interface CustomListItemSummary {
	listId: string;
	tmdbId: number;
	mediaType: string;
}

export interface WatchlistData {
	watchItems: WatchItemSummary[];
	lists: CustomListSummary[];
	listItems: CustomListItemSummary[];
	inputStats: {
		movieCount: number;
		tvCount: number;
		episodesWatched: number;
		totalItems: number;
	};
}

export interface FeedbackSignals {
	likedTitles?: string[];
	dislikedTitles?: string[];
	dislikedTmdbIds?: number[];
	previousTitles?: string[];
}

export interface BasePromptConfig {
	mediaTypePreference?: string;
	yearFrom?: number;
	yearTo?: number;
	existingIds: number[];
	existingTitles: string[];
	feedback?: FeedbackSignals;
	watchlistText?: string;
	recommendationGoal?: string;
	statsText?: string;
}

export const RESPONSE_SCHEMA = `Respond with this exact JSON schema:
{
  "recommendations": [
    {
      "title": "string - exact official title",
      "tmdbId": "number or null if unknown",
      "mediaType": "movie" or "tv",
      "relevanceScore": "number 0-100",
      "reasoning": "string - 1-2 sentence explanation"
    }
  ]
}`;

export function mediaLabel(mediaTypePreference?: string): string {
	return mediaTypePreference === "movie"
		? "movies"
		: mediaTypePreference === "tv"
			? "TV shows"
			: "movies and TV shows";
}

export function clampTitleCount(count?: number): number {
	return Math.min(Math.max(count ?? 10, 1), 30);
}

/** Index watch items by the `tmdbId_mediaType` key used across prompt builders. */
export function indexWatchItemsByMediaKey(
	items: WatchItemSummary[],
): Map<string, WatchItemSummary> {
	const map = new Map<string, WatchItemSummary>();
	for (const w of items) {
		map.set(`${w.tmdbId}_${w.mediaType}`, w);
	}
	return map;
}

export function formatItem(i: WatchItemSummary): string {
	const parts = [
		`- ${i.title ?? "Unknown"} (TMDB ID: ${i.tmdbId}, ${i.mediaType})`,
	];
	if (i.rating) parts.push(`Rating: ${i.rating}/10`);
	if (i.reaction) parts.push(`Reaction: ${i.reaction}`);
	return parts.join(" | ");
}

export function buildWatchlistContext(
	data: WatchlistData,
	excludeTmdbIds: number[] = [],
): {
	contextPrompt: string;
	existingIds: number[];
	existingTitles: string[];
} {
	const { watchItems } = data;

	const loved = watchItems.filter(
		(i) => i.reaction === "loved" || i.reaction === "liked",
	);
	const watching = watchItems.filter((i) => i.progressStatus === "watching");
	const watchLater = watchItems.filter(
		(i) => i.progressStatus === "watch-later",
	);
	const disliked = watchItems.filter(
		(i) =>
			i.reaction === "not-for-me" ||
			i.reaction === "mixed" ||
			i.progressStatus === "dropped",
	);
	const done = watchItems.filter(
		(i) =>
			i.progressStatus === "done" &&
			i.reaction !== "loved" &&
			i.reaction !== "liked",
	);

	// Key by tmdbId + mediaType so a movie and TV show sharing a TMDB id never
	// collide in the prioritized set (matches the lookup keys used elsewhere).
	const mediaKey = (item: WatchItemSummary) =>
		`${item.tmdbId}:${item.mediaType}`;
	const prioritized = new Set(
		[...loved, ...watching, ...done, ...watchLater, ...disliked]
			.slice(0, 50)
			.map(mediaKey),
	);
	const existingIds = [
		...new Set([...watchItems.map((i) => i.tmdbId), ...excludeTmdbIds]),
	];
	const existingTitles = watchItems
		.map((i) => i.title)
		.filter((title): title is string => !!title);
	const inScope = (item: WatchItemSummary) => prioritized.has(mediaKey(item));

	let prompt = "";
	const scopedLoved = loved.filter(inScope);
	const scopedWatching = watching.filter(inScope);
	const scopedDone = done.filter(inScope);
	const scopedWatchLater = watchLater.filter(inScope);
	const scopedDisliked = disliked.filter(inScope);

	if (scopedLoved.length > 0) {
		prompt += `## Content I loved/liked:\n${scopedLoved.map(formatItem).join("\n")}\n\n`;
	}
	if (scopedWatching.length > 0) {
		prompt += `## Currently watching:\n${scopedWatching.map(formatItem).join("\n")}\n\n`;
	}
	if (scopedDone.length > 0) {
		prompt += `## Completed (no strong reaction):\n${scopedDone.map(formatItem).join("\n")}\n\n`;
	}
	if (scopedWatchLater.length > 0) {
		prompt += `## On my watch-later list:\n${scopedWatchLater.map(formatItem).join("\n")}\n\n`;
	}
	if (scopedDisliked.length > 0) {
		prompt += `## Content I didn't enjoy (dropped/mixed/not-for-me):\n${scopedDisliked.map(formatItem).join("\n")}\n\n`;
	}

	return { contextPrompt: prompt, existingIds, existingTitles };
}

export function appendFeedbackSignals(
	prompt: string,
	feedback?: FeedbackSignals,
): string {
	let result = prompt;
	if (feedback?.likedTitles && feedback.likedTitles.length > 0) {
		result += `## Recommendations I explicitly liked and want more content similar to:\n${feedback.likedTitles.map((t) => `- ${t}`).join("\n")}\n\n`;
	}
	if (feedback?.dislikedTitles && feedback.dislikedTitles.length > 0) {
		result += `## Recommendations I explicitly marked as "not interested" (avoid similar styles/genres):\n${feedback.dislikedTitles.map((t) => `- ${t}`).join("\n")}\n\n`;
	}
	if (feedback?.previousTitles && feedback.previousTitles.length > 0) {
		result += `## Previously recommended titles (do NOT repeat these):\n${feedback.previousTitles.map((t) => `- ${t}`).join("\n")}\n\n`;
	}
	return result;
}

export function buildBasePromptSections(config: BasePromptConfig): string {
	let prompt = "";

	prompt = appendFeedbackSignals(prompt, config.feedback);

	if (config.statsText) {
		prompt += config.statsText;
	}

	if (config.mediaTypePreference === "movie") {
		prompt += `IMPORTANT: Only recommend MOVIES. Do not suggest any TV shows.\n\n`;
	} else if (config.mediaTypePreference === "tv") {
		prompt += `IMPORTANT: Only recommend TV SHOWS. Do not suggest any movies.\n\n`;
	}

	if (config.recommendationGoal) {
		prompt += config.recommendationGoal;
	}

	if (config.existingIds.length > 0) {
		const wlText = config.watchlistText ?? " (already in my watchlist)";
		prompt += `Do NOT recommend any title with these TMDB IDs${wlText}: ${config.existingIds.join(", ")}\n`;
	}
	if (config.existingTitles.length > 0) {
		prompt += `Do NOT recommend any of these already tracked titles by name: ${config.existingTitles.join(", ")}\n`;
	}
	prompt += "\n";

	if (config.yearFrom || config.yearTo) {
		const from = config.yearFrom ?? 1900;
		const to = config.yearTo ?? new Date().getFullYear();
		prompt += `IMPORTANT: Only recommend titles released between ${from} and ${to} (inclusive).\n\n`;
	}

	return prompt;
}

export function buildWatchlistPrompt(
	data: WatchlistData,
	mediaTypePreference?: string,
	excludeTmdbIds: number[] = [],
	yearFrom?: number,
	yearTo?: number,
	count?: number,
	feedback?: FeedbackSignals,
): string {
	const { lists, listItems, inputStats } = data;
	const { contextPrompt, existingIds, existingTitles } = buildWatchlistContext(
		data,
		excludeTmdbIds,
	);

	let prompt = `Here is my watchlist data:\n\n${contextPrompt}`;

	const listItemsByListId = new Map<string, CustomListItemSummary[]>();
	for (const li of listItems) {
		const listIdStr = String(li.listId);
		let items = listItemsByListId.get(listIdStr);
		if (!items) {
			items = [];
			listItemsByListId.set(listIdStr, items);
		}
		items.push(li);
	}

	const watchItemByMediaKey = indexWatchItemsByMediaKey(data.watchItems);

	if (lists.length > 0) {
		prompt += `## My custom lists:\n`;
		for (const list of lists) {
			const items = listItemsByListId.get(String(list._id)) ?? [];
			const titles = items
				.map((li) => {
					const wi = watchItemByMediaKey.get(`${li.tmdbId}_${li.mediaType}`);
					return wi?.title ?? `TMDB:${li.tmdbId}`;
				})
				.join(", ");
			prompt += `- "${list.name}": ${titles}\n`;
		}
		prompt += "\n";
	}

	const titleCount = clampTitleCount(count);

	prompt += buildBasePromptSections({
		mediaTypePreference,
		yearFrom,
		yearTo,
		existingIds,
		existingTitles,
		feedback,
		watchlistText: " (already in my watchlist)",
		recommendationGoal: `Based on this data, recommend exactly ${titleCount} ${mediaLabel(mediaTypePreference)} I would likely enjoy.\n`,
		statsText: `## Stats:\n- ${inputStats.movieCount} movies, ${inputStats.tvCount} TV shows tracked\n- ${inputStats.episodesWatched} episodes watched\n\n`,
	});

	prompt += RESPONSE_SCHEMA;

	return prompt;
}

export function buildGenrePrompt(
	data: WatchlistData,
	mediaTypePreference?: string,
	genrePreference?: string,
	excludeTmdbIds: number[] = [],
	yearFrom?: number,
	yearTo?: number,
	count?: number,
	feedback?: FeedbackSignals,
): string {
	const { existingIds, existingTitles } = buildWatchlistContext(
		data,
		excludeTmdbIds,
	);

	const titleCount = clampTitleCount(count);

	let prompt = `Recommend me exactly ${titleCount} popular and highly-rated ${mediaLabel(mediaTypePreference)}`;

	if (genrePreference) {
		prompt += ` in these genres: ${genrePreference}`;
	}
	prompt += `.\n\n`;

	prompt += `Focus on well-known, critically acclaimed titles that are widely loved. Include a mix of classic and recent titles.\n\n`;

	prompt += buildBasePromptSections({
		mediaTypePreference,
		yearFrom,
		yearTo,
		existingIds,
		existingTitles,
		feedback,
		watchlistText: " (already in my watchlist)",
	});

	prompt += RESPONSE_SCHEMA;
	return prompt;
}

export function buildCustomListPrompt(
	data: WatchlistData,
	listId: string,
	mediaTypePreference?: string,
	excludeTmdbIds: number[] = [],
	yearFrom?: number,
	yearTo?: number,
	count?: number,
	feedback?: FeedbackSignals,
): string {
	const { existingIds, existingTitles } = buildWatchlistContext(
		data,
		excludeTmdbIds,
	);

	const titleCount = clampTitleCount(count);

	const list = data.lists.find((l) => l._id === listId);
	const listName = list?.name ?? "this custom list";

	const watchItemByMediaKey = indexWatchItemsByMediaKey(data.watchItems);

	const items = data.listItems.filter((li) => li.listId === listId);
	const titles = items
		.map((li) => {
			const wi = watchItemByMediaKey.get(`${li.tmdbId}_${li.mediaType}`);
			return wi?.title
				? `- ${wi.title} (${li.mediaType})`
				: `- TMDB ID: ${li.tmdbId} (${li.mediaType})`;
		})
		.join("\n");

	let prompt = `Here are the movies and TV shows in my custom list "${listName}":\n\n${titles}\n\n`;

	prompt += buildBasePromptSections({
		mediaTypePreference,
		yearFrom,
		yearTo,
		existingIds,
		existingTitles,
		feedback,
		watchlistText: " (already in my overall watchlist)",
		recommendationGoal: `Based on these titles, recommend exactly ${titleCount} ${mediaLabel(mediaTypePreference)} I would likely enjoy.\nFind movies/shows that share similar themes, genres, directors, actors, or vibe as the ones in the list.\n\n`,
	});

	prompt += RESPONSE_SCHEMA;
	return prompt;
}

export function buildHomepageRecommendationsPrompt(
	data: WatchlistData,
	likedFeedbackTitles: string[],
	dislikedFeedbackTitles: string[],
	excludeTmdbIds: number[],
	previousTitles: string[],
): string {
	const { inputStats } = data;
	const { contextPrompt, existingIds, existingTitles } = buildWatchlistContext(
		data,
		excludeTmdbIds,
	);

	let prompt =
		`You are generating personalized recommendations for the user's homepage.\n\n` +
		`Here is the user's watchlist/viewing data:\n\n` +
		contextPrompt;

	prompt += buildBasePromptSections({
		existingIds,
		existingTitles,
		feedback: {
			likedTitles: likedFeedbackTitles,
			dislikedTitles: dislikedFeedbackTitles,
			previousTitles,
		},
		watchlistText: "",
		recommendationGoal: `Based on this data, recommend exactly 15 movies and 15 TV shows I would likely enjoy.\n`,
		statsText: `## Stats:\n- ${inputStats.movieCount} movies, ${inputStats.tvCount} TV shows tracked\n- ${inputStats.episodesWatched} episodes watched\n\n`,
	});

	prompt += RESPONSE_SCHEMA;

	return prompt;
}
