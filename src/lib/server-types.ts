import type {
	aiRecommendations,
	episodeProgress,
	listItems,
	lists,
	watchItems,
} from "@/server/db/schema";

/** `watch_items` D1 row (same shape `getWatchlist`/`getMediaState` return). */
export type WatchItemRow = typeof watchItems.$inferSelect;

/** `episode_progress` D1 row. */
export type EpisodeProgressRow = typeof episodeProgress.$inferSelect;

/** Enriched `lists` row (includes previews + itemCount). */
export type CustomListRow = typeof lists.$inferSelect & {
	previews: string[];
	itemCount: number;
};

/** Enriched `list_items` row. */
export type ListItemRow = typeof listItems.$inferSelect & {
	title: string | null;
	image: string | null;
	rating: number | null;
	release_date: string | null;
	overview: string | null;
	progressStatus: string | null;
	reaction: string | null;
};

export type AllEpisodeProgressRow = typeof episodeProgress.$inferSelect;

export type RecommendationHistoryRow = typeof aiRecommendations.$inferSelect;

export type MediaStateRow = typeof watchItems.$inferSelect;
