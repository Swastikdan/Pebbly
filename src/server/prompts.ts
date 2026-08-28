// Pure prompt-building helpers for the recommendation engine. Kept dependency-free
// (no server imports) so they are trivially testable and reusable anywhere.

import type { MediaType } from "@/lib/media-types";

export interface WatchItemSummary {
  tmdbId: number;
  mediaType: MediaType;
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

export interface RecommendationCandidate {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  rating: number;
  voteCount: number;
}

function formatStats(inputStats: {
  movieCount: number;
  tvCount: number;
  episodesWatched: number;
}): string {
  return `## Stats:\n- ${inputStats.movieCount} movies, ${inputStats.tvCount} TV shows tracked\n- ${inputStats.episodesWatched} episodes watched\n\n`;
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

const RESPONSE_SCHEMA = `Respond with this exact JSON schema:
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
}

Before returning, verify that every recommendation is unique by media type and
official title. Never return the same movie or TV show twice, even if one entry
has a TMDB ID and another does not.`;

function mediaLabel(mediaTypePreference?: string): string {
  return mediaTypePreference === "movie"
    ? "movies"
    : mediaTypePreference === "tv"
      ? "TV shows"
      : "movies and TV shows";
}

function clampTitleCount(count?: number): number {
  return Math.min(Math.max(count ?? 10, 1), 30);
}

function indexWatchItemsByMediaKey(
  items: WatchItemSummary[],
): Map<string, WatchItemSummary> {
  const map = new Map<string, WatchItemSummary>();
  for (const w of items) {
    map.set(`${w.tmdbId}_${w.mediaType}`, w);
  }
  return map;
}

function formatItem(i: WatchItemSummary): string {
  const parts = [
    `- ${i.title ?? "Unknown"} (TMDB ID: ${i.tmdbId}, ${i.mediaType})`,
  ];
  if (i.rating) parts.push(`Rating: ${i.rating}/10`);
  if (i.reaction) parts.push(`Reaction: ${i.reaction}`);
  return parts.join(" | ");
}

function buildWatchlistContext(
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

function buildBasePromptSections(config: BasePromptConfig): string {
  let prompt = "";
  const { feedback } = config;

  if (feedback?.likedTitles && feedback.likedTitles.length > 0) {
    prompt += `## Recommendations I explicitly liked and want more content similar to:\n${feedback.likedTitles.map((t) => `- ${t}`).join("\n")}\n\n`;
  }
  if (feedback?.dislikedTitles && feedback.dislikedTitles.length > 0) {
    prompt += `## Recommendations I explicitly marked as "not interested" (avoid similar styles/genres):\n${feedback.dislikedTitles.map((t) => `- ${t}`).join("\n")}\n\n`;
  }
  if (feedback?.previousTitles && feedback.previousTitles.length > 0) {
    prompt += `## Previously recommended titles (do NOT repeat these):\n${feedback.previousTitles.map((t) => `- ${t}`).join("\n")}\n\n`;
  }

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

function buildCustomListsSection(
  lists: CustomListSummary[],
  listItems: CustomListItemSummary[],
  watchItems: WatchItemSummary[],
): string {
  if (lists.length === 0) return "";

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

  const watchItemByMediaKey = indexWatchItemsByMediaKey(watchItems);

  let section = `## My custom lists:\n`;
  for (const list of lists) {
    const items = listItemsByListId.get(String(list._id)) ?? [];
    const titles = items
      .map((li) => {
        const wi = watchItemByMediaKey.get(`${li.tmdbId}_${li.mediaType}`);
        return wi?.title ?? `TMDB:${li.tmdbId}`;
      })
      .join(", ");
    section += `- "${list.name}": ${titles}\n`;
  }
  return `${section}\n`;
}

interface SectionedPromptConfig {
  intro: string;
  contextSections?: string[];
  base: BasePromptConfig;
}

function buildSectionedPrompt(config: SectionedPromptConfig): string {
  let prompt = config.intro;
  for (const section of config.contextSections ?? []) {
    prompt += section;
  }
  return prompt + buildBasePromptSections(config.base) + RESPONSE_SCHEMA;
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
  const { contextPrompt, existingIds, existingTitles } = buildWatchlistContext(
    data,
    excludeTmdbIds,
  );
  const titleCount = clampTitleCount(count);

  return buildSectionedPrompt({
    intro: `Here is my watchlist data:\n\n${contextPrompt}`,
    contextSections: [
      buildCustomListsSection(data.lists, data.listItems, data.watchItems),
    ],
    base: {
      mediaTypePreference,
      yearFrom,
      yearTo,
      existingIds,
      existingTitles,
      feedback,
      watchlistText: " (already in my watchlist)",
      recommendationGoal: `Based on this data, recommend exactly ${titleCount} ${mediaLabel(mediaTypePreference)} I would likely enjoy.\n`,
      statsText: formatStats(data.inputStats),
    },
  });
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

  let intro = `Recommend me exactly ${titleCount} popular and highly-rated ${mediaLabel(mediaTypePreference)}`;
  if (genrePreference) {
    intro += ` in these genres: ${genrePreference}`;
  }
  intro += `.\n\n`;
  intro += `Focus on well-known, critically acclaimed titles that are widely loved. Include a mix of classic and recent titles.\n\n`;

  return buildSectionedPrompt({
    intro,
    base: {
      mediaTypePreference,
      yearFrom,
      yearTo,
      existingIds,
      existingTitles,
      feedback,
      watchlistText: " (already in my watchlist)",
    },
  });
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

  const titles = data.listItems
    .filter((li) => li.listId === listId)
    .map((li) => {
      const wi = watchItemByMediaKey.get(`${li.tmdbId}_${li.mediaType}`);
      return wi?.title
        ? `- ${wi.title} (${li.mediaType})`
        : `- TMDB ID: ${li.tmdbId} (${li.mediaType})`;
    })
    .join("\n");

  return buildSectionedPrompt({
    intro: `Here are the movies and TV shows in my custom list "${listName}":\n\n${titles}\n\n`,
    base: {
      mediaTypePreference,
      yearFrom,
      yearTo,
      existingIds,
      existingTitles,
      feedback,
      watchlistText: " (already in my overall watchlist)",
      recommendationGoal: `Based on these titles, recommend exactly ${titleCount} ${mediaLabel(mediaTypePreference)} I would likely enjoy.\nFind movies/shows that share similar themes, genres, directors, actors, or vibe as the ones in the list.\n\n`,
    },
  });
}

export function buildCandidateRecommendationPrompt(args: {
  candidates: RecommendationCandidate[];
  likedTitles: string[];
  dislikedTitles: string[];
  previousTitles: string[];
  mediaTypePreference?: string;
  genrePreference?: string;
  count: number;
  goal?: string;
}): string {
  const candidateCatalog = args.candidates
    .map(
      (candidate) =>
        `- ${candidate.mediaType}:${candidate.tmdbId} | ${candidate.title} | ${candidate.year ?? "unknown year"} | rating ${candidate.rating}/10 | votes ${candidate.voteCount}`,
    )
    .join("\n");
  const liked = args.likedTitles.length
    ? `Liked titles: ${args.likedTitles.join(", ")}\n`
    : "";
  const disliked = args.dislikedTitles.length
    ? `Avoid titles/styles related to: ${args.dislikedTitles.join(", ")}\n`
    : "";
  const previous = args.previousTitles.length
    ? `Do not repeat these previously shown titles: ${args.previousTitles.join(", ")}\n`
    : "";
  const typeRule =
    args.mediaTypePreference === "movie"
      ? "Select movies only."
      : args.mediaTypePreference === "tv"
        ? "Select TV shows only."
        : "Select movies and TV shows.";

  return `You are ranking a current TMDB candidate catalog for personalized recommendations.
You may ONLY select candidates from the catalog below. Never invent a title, TMDB ID, or media type. Return exactly ${args.count} recommendations when enough candidates exist. ${typeRule}
${liked}${disliked}${previous}${args.genrePreference ? `Preferred genres: ${args.genrePreference}\n` : ""}${args.goal ?? "Choose the strongest, most varied matches for the user's taste."}

Candidate catalog:
${candidateCatalog}

Return this exact JSON shape:
{
  "recommendations": [
    {
      "title": "copy the candidate title exactly",
      "tmdbId": 123,
      "mediaType": "movie or tv",
      "relevanceScore": "number from 0 to 100",
      "reasoning": "brief explanation based on the user's preferences"
    }
  ]
}
Every returned recommendation must match one catalog entry exactly. Do not return duplicates.`;
}

export function buildHomepageRecommendationsPrompt(
  data: WatchlistData,
  likedFeedbackTitles: string[],
  dislikedFeedbackTitles: string[],
  excludeTmdbIds: number[],
  previousTitles: string[],
): string {
  const { contextPrompt, existingIds, existingTitles } = buildWatchlistContext(
    data,
    excludeTmdbIds,
  );

  return buildSectionedPrompt({
    intro:
      `You are generating personalized recommendations for the user's homepage.\n\n` +
      `Here is the user's watchlist/viewing data:\n\n` +
      contextPrompt,
    base: {
      existingIds,
      existingTitles,
      feedback: {
        likedTitles: likedFeedbackTitles,
        dislikedTitles: dislikedFeedbackTitles,
        previousTitles,
      },
      watchlistText: "",
      recommendationGoal: `Based on this data, recommend exactly 15 movies and 15 TV shows I would likely enjoy.\n`,
      statsText: formatStats(data.inputStats),
    },
  });
}
