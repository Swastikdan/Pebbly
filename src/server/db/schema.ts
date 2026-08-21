import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(), // Convex _id | uuid
	tokenIdentifier: text("token_identifier").notNull().unique(),
	name: text("name"),
	image: text("image"),
	email: text("email"),
	roles: text("roles", { mode: "json" }).$type<string[]>().default([]),
	// No `is_admin` column: admin status lives in Clerk's public metadata (the
	// signed JWT claim or the live Clerk API). A stored flag goes stale the
	// moment someone is demoted in Clerk, so it is never consulted for access
	// decisions, keeping it in the DB only invited drift.
	isBanned: integer("is_banned", { mode: "boolean" }).default(false),
	// Monotonic revision counters for the user's data domains. Bumped on every
	// relevant mutation so clients can poll this single small row to detect
	// cross-device changes instead of re-fetching whole collections (which is
	// O(collection size) in D1 rows read).
	watchlistRev: integer("watchlist_rev").default(0).notNull(),
	listsRev: integer("lists_rev").default(0).notNull(),
	aiRev: integer("ai_rev").default(0).notNull(),
	// Revision for RBAC state (roles, ban flag, global feature flags) so the
	// same single-row version poll can drive permission refreshes; a global
	// feature-flag toggle bumps every user's counter.
	permsRev: integer("perms_rev").default(0).notNull(),
});

export const watchItems = sqliteTable(
	"watch_items",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type", { enum: ["movie", "tv"] }).notNull(),
		inWatchlist: integer("in_watchlist", { mode: "boolean" }).default(false),
		progressStatus: text("progress_status", {
			enum: ["watch-later", "watching", "done", "dropped"],
		}),
		reaction: text("reaction", {
			enum: ["loved", "liked", "mixed", "not-for-me", "recommended"],
		}),
		progress: integer("progress").default(0), // 0..100
		title: text("title"),
		image: text("image"),
		rating: real("rating"),
		releaseDate: text("release_date"),
		overview: text("overview"),
		updatedAt: integer("updated_at").notNull(), // ms epoch
	},
	(t) => [
		uniqueIndex("watch_items_user_media_uq").on(
			t.userId,
			t.tmdbId,
			t.mediaType,
		),
		index("watch_items_user_status_idx").on(t.userId, t.progressStatus),
		index("watch_items_user_updated_idx").on(t.userId, t.updatedAt),
		check("watch_items_progress_range", sql`${t.progress} between 0 and 100`),
		check("watch_items_rating_range", sql`${t.rating} between 0 and 10`),
	],
);

export const watchlistSnapshots = sqliteTable(
	"watchlist_snapshots",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		items: text("items", { mode: "json" }).$type<
			Array<{ tmdbId: number; mediaType: string }>
		>(),
		createdAt: integer("created_at").notNull(),
	},
	(t) => [index("snapshots_user_created_idx").on(t.userId, t.createdAt)],
);

export const lists = sqliteTable(
	"lists",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color"),
		visibility: text("visibility"),
		listType: text("list_type"),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => [
		uniqueIndex("lists_user_name_uq").on(t.userId, t.name),
		index("lists_user_sort_idx").on(t.userId, t.sortOrder),
	],
);

export const listItems = sqliteTable(
	"list_items",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		listId: text("list_id")
			.notNull()
			.references(() => lists.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type", { enum: ["movie", "tv"] }).notNull(),
		addedAt: integer("added_at").notNull(),
		title: text("title"),
		image: text("image"),
		backdrop: text("backdrop"),
		rating: real("rating"),
		releaseDate: text("release_date"),
		overview: text("overview"),
	},
	(t) => [
		uniqueIndex("list_items_list_media_uq").on(t.listId, t.tmdbId, t.mediaType),
		// Covers both (user, media) and user-only lookups via leftmost prefix.
		index("list_items_user_media_idx").on(t.userId, t.tmdbId, t.mediaType),
	],
);

export const episodeProgress = sqliteTable(
	"episode_progress",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		season: integer("season").notNull(),
		episode: integer("episode").notNull(),
		isWatched: integer("is_watched", { mode: "boolean" })
			.notNull()
			.default(false),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => [
		// Covers (user), (user, show), and (user, show, season), the 4 Convex indexes collapse here.
		uniqueIndex("episode_user_season_ep_uq").on(
			t.userId,
			t.tmdbId,
			t.season,
			t.episode,
		),
	],
);

export const aiRecommendations = sqliteTable(
	"ai_recommendations",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		recommendations: text("recommendations", { mode: "json" })
			.$type<Recommendation[]>()
			.notNull(),
		originalRecommendations: text("original_recommendations", {
			mode: "json",
		}).$type<Recommendation[]>(),
		watchlistHash: text("watchlist_hash").notNull().default(""),
		inputStats: text("input_stats", { mode: "json" })
			.$type<InputStats>()
			.notNull(),
		model: text("model").notNull(),
		mediaTypePreference: text("media_type_preference", {
			enum: ["movie", "tv"],
		}),
		genrePreference: text("genre_preference"),
		generationType: text("generation_type"),
		verified: integer("verified", { mode: "boolean" }).default(false),
		createdAt: integer("created_at").notNull(),
	},
	(t) => [index("ai_recs_user_created_idx").on(t.userId, t.createdAt)],
);

export const homepageRecommendations = sqliteTable("homepage_recommendations", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: "cascade" }),
	recommendations: text("recommendations", { mode: "json" })
		.$type<Recommendation[]>()
		.notNull(),
	previousRecommendations: text("previous_recommendations", {
		mode: "json",
	}).$type<Recommendation[]>(),
	lastAttemptedAt: integer("last_attempted_at").notNull().default(0),
	lastUpdatedAt: integer("last_updated_at").notNull().default(0),
	status: text("status").notNull().default("none"),
});

export const recommendationFeedback = sqliteTable(
	"recommendation_feedback",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type", { enum: ["movie", "tv"] }).notNull(),
		title: text("title").notNull(),
		feedback: text("feedback", {
			enum: ["like", "not_interested", "dislike"],
		}).notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => [
		uniqueIndex("feedback_user_media_uq").on(t.userId, t.tmdbId, t.mediaType),
		// (user, feedback) drives the homepage/generation feedback lookups, must not be dropped
		index("feedback_user_feedback_idx").on(t.userId, t.feedback),
	],
);

export const snapshotCursors = sqliteTable("snapshot_cursors", {
	key: text("key").primaryKey(),
	value: text("value"),
	updatedAt: integer("updated_at").notNull(),
});

export const rolePermissions = sqliteTable(
	"role_permissions",
	{
		role: text("role").notNull(),
		feature: text("feature").notNull(),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	},
	(t) => [primaryKey({ columns: [t.role, t.feature] })],
);

export type Recommendation = {
	title: string;
	tmdbId: number | null;
	mediaType: "movie" | "tv";
	relevanceScore: number;
	reasoning: string;
};

export type InputStats = {
	movieCount: number;
	tvCount: number;
	episodesWatched: number;
	totalItems: number;
};
