import type {
  aiRecommendations,
  episodeProgress,
  listItems,
  lists,
  watchItems,
} from "@/server/db/schema";
import type { ProgressStatus, Reaction } from "@/server/schema/common";

export type WatchItemRow = typeof watchItems.$inferSelect;

export type EpisodeProgressRow = typeof episodeProgress.$inferSelect;

export type CustomListRow = typeof lists.$inferSelect & {
  previews: string[];
  itemCount: number;
};

export type ListItemRow = typeof listItems.$inferSelect & {
  title: string | null;
  image: string | null;
  rating: number | null;
  release_date: string | null;
  overview: string | null;
  progressStatus: ProgressStatus | null;
  reaction: Reaction | null;
};

export type RecommendationHistoryRow = typeof aiRecommendations.$inferSelect;
