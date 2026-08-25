import type { SQL } from "drizzle-orm";
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

import type { MediaType } from "@/lib/media-types";
import { MEDIA_TYPES } from "@/lib/media-types";
import { PROGRESS_STATUSES, REACTIONS } from "@/server/schema/common";
import { LIST_TYPES, LIST_VISIBILITIES } from "@/server/schema/lists";
import { HOMEPAGE_REC_STATUSES } from "@/server/schema/recommendations";

/**
 * Render a canonical constant list as inline SQL string literals for CHECK
 * constraints. Table definitions cannot carry bound parameters, so values
 * must be embedded as literals; the quote-doubling keeps the generated SQL
 * valid even if a constant ever contains a quote.
 */
function enumLiterals(values: readonly string[]): SQL {
  return sql.join(
    values.map((value) => sql.raw(`'${value.replaceAll("'", "''")}'`)),
    sql`, `,
  );
}

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
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
    mediaType: text("media_type", { enum: MEDIA_TYPES }).notNull(),
    inWatchlist: integer("in_watchlist", { mode: "boolean" }).default(false),
    progressStatus: text("progress_status", {
      enum: PROGRESS_STATUSES,
    }),
    reaction: text("reaction", {
      enum: REACTIONS,
    }),
    progress: integer("progress").default(0),
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
      Array<{ tmdbId: number; mediaType: MediaType }>
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
    description: text("description"),
    visibility: text("visibility", { enum: [...LIST_VISIBILITIES] }),
    listType: text("list_type", { enum: [...LIST_TYPES] }),
    sortType: text("sort_type", {
      enum: ["unordered", "ordered"],
    })
      .notNull()
      .default("unordered"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("lists_user_name_uq").on(t.userId, t.name),
    index("lists_user_sort_idx").on(t.userId, t.sortOrder),
    check(
      "lists_visibility_ck",
      sql`${t.visibility} in (${enumLiterals(LIST_VISIBILITIES)})`,
    ),
    check(
      "lists_list_type_ck",
      sql`${t.listType} in (${enumLiterals(LIST_TYPES)})`,
    ),
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
    mediaType: text("media_type", { enum: MEDIA_TYPES }).notNull(),
    position: integer("position").notNull().default(0),
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
      enum: [...MEDIA_TYPES],
    }),
    genrePreference: text("genre_preference"),
    generationType: text("generation_type"),
    verified: integer("verified", { mode: "boolean" }).default(false),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("ai_recs_user_created_idx").on(t.userId, t.createdAt)],
);

export const homepageRecommendations = sqliteTable(
  "homepage_recommendations",
  {
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
    status: text("status", { enum: [...HOMEPAGE_REC_STATUSES] })
      .notNull()
      .default("none"),
  },
  (t) => [
    check(
      "homepage_rec_status_ck",
      sql`${t.status} in (${enumLiterals(HOMEPAGE_REC_STATUSES)})`,
    ),
  ],
);

export const recommendationFeedback = sqliteTable(
  "recommendation_feedback",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tmdbId: integer("tmdb_id").notNull(),
    mediaType: text("media_type", { enum: MEDIA_TYPES }).notNull(),
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

/**
 * Generic rate-limit ledger. Each row is one attempt against a `key`
 * (e.g. `ai-gen:<userId>`) within its time window; see
 * helpers/rate-limit.ts. Kept separate from domain tables so cooldown state
 * never doubles as user-facing data (the previous scheme stored a fake
 * ai_recommendations row as the marker, forcing special-case guards).
 */
export const rateLimitAttempts = sqliteTable(
  "rate_limit_attempts",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("rate_limit_key_created_idx").on(t.key, t.createdAt)],
);

export type Recommendation = {
  title: string;
  tmdbId: number | null;
  mediaType: MediaType;
  relevanceScore: number;
  reasoning: string;
};

export type InputStats = {
  movieCount: number;
  tvCount: number;
  episodesWatched: number;
  totalItems: number;
};
