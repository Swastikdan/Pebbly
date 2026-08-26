# Data model (Cloudflare D1)

Defined in `src/server/db/schema.ts` (Drizzle SQLite) and applied to D1 via
the SQL migrations in `drizzle/` (generated with `pnpm db:generate`, applied
with `wrangler d1 migrations apply pebbly [--local|--remote]`).

Conventions:

- **IDs**: `text` primary keys, `crypto.randomUUID()` at write time (or a
  `clerk|<sub>` token identifier for users).
- **Timestamps**: integer **milliseconds since epoch** (`Date.now()`).
- **Enums**: `text` columns with a Drizzle `enum` type. The allowed values are
  defined once in `src/server/schema/common.ts` and shared client/server.
- **Foreign keys**: `ON DELETE cascade`, child rows are removed with their
  parent.
- **JSON-ish columns**: `text` with `{ mode: "json" }` (Drizzle serializes a
  typed array/object to JSON text and back).

## Tables

### users

Identity for signed-in users, mirrored from Clerk.

| Column                                                 | Type             | Notes                                                                                                                                                                                                                                                                                |
| :----------------------------------------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                   | text PK          | uuid                                                                                                                                                                                                                                                                                 |
| `token_identifier`                                     | text, **unique** | `clerk                                                                                                                                                                                                                                                                               | <sub>` (legacy formats supported at lookup time) |
| `name` / `image` / `email`                             | text             | profile snapshot from Clerk claims                                                                                                                                                                                                                                                   |
| `roles`                                                | text (json)      | dynamic RBAC roles: `video-player`, `ai-integrations`                                                                                                                                                                                                                                |
| `is_banned`                                            | boolean          | default `false`                                                                                                                                                                                                                                                                      |
| `watchlist_rev` / `lists_rev` / `ai_rev` / `perms_rev` | integer          | monotonic per-domain revision counters for cross-device change detection, bumped atomically by every relevant mutation, polled via `getDataVersion` (see ADR-015). `perms_rev` covers RBAC state: role/ban changes bump the target user, global feature-flag toggles bump every user |

> **No `is_admin` column.** Admin status lives in Clerk's public metadata
> (JWT claim or live API). The column existed in the initial migration
> (`0000`) and was dropped in `0003`, see ADR-004.

### watch_items

One row per (user, TMDB title). The heart of the watchlist.

| Column                                          | Type            | Notes                                                                 |
| :---------------------------------------------- | :-------------- | :-------------------------------------------------------------------- |
| `id`                                            | text PK         |                                                                       |
| `user_id`                                       | text FK → users | cascade                                                               |
| `tmdb_id`                                       | integer         |                                                                       |
| `media_type`                                    | text enum       | `movie` \| `tv`                                                       |
| `in_watchlist`                                  | boolean         | default `false`, a row can survive removal to keep progress/reactions |
| `progress_status`                               | text enum       | `watch-later` \| `watching` \| `done` \| `dropped`                    |
| `reaction`                                      | text enum       | `loved` \| `liked` \| `mixed` \| `not-for-me` \| `recommended`        |
| `progress`                                      | integer 0–100   | check constraint                                                      |
| `title` / `image` / `overview` / `release_date` | text            | denormalized metadata snapshot for list rendering                     |
| `rating`                                        | real 0–10       | check constraint                                                      |
| `updated_at`                                    | integer         | ms epoch, drives "recently updated" ordering                          |

Indexes: `(user_id, tmdb_id, media_type)` **unique** · `(user_id, progress_status)` ·
`(user_id, updated_at)`. Checks: `progress between 0 and 100`,
`rating between 0 and 10`.

### episode_progress

Per-episode watched state for TV shows.

| Column               | Type            | Notes           |
| :------------------- | :-------------- | :-------------- |
| `id`                 | text PK         |                 |
| `user_id`            | text FK → users | cascade         |
| `tmdb_id`            | integer         |                 |
| `season` / `episode` | integer         |                 |
| `is_watched`         | boolean         | default `false` |
| `updated_at`         | integer         |                 |

Index: `(user_id, tmdb_id, season, episode)` **unique**, covers (user),
(user, show), and (user, show, season) lookups with leftmost-prefix rules
(replacing four Convex indexes).

### watchlist_snapshots

Immutable history of "what was in my watchlist", the daily cron output and
the source of the "recently added" / account activity view.

| Column       | Type            | Notes                     |
| :----------- | :-------------- | :------------------------ |
| `id`         | text PK         |                           |
| `user_id`    | text FK → users | cascade                   |
| `items`      | text (json)     | `[{ tmdbId, mediaType }]` |
| `created_at` | integer         |                           |

Index: `(user_id, created_at)`. Snapshots are only written when the current
watchlist differs from the latest snapshot (see `helpers/snapshots.ts`).

### lists

Custom user lists (including the auto-created **Pebbly Picks** list).

| Column                                               | Type            | Notes                                                                                                                                         |
| :--------------------------------------------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                 | text PK         |                                                                                                                                               |
| `user_id`                                            | text FK → users | cascade                                                                                                                                       |
| `name`                                               | text            | unique per user, 1–50 chars (enforced by validation)                                                                                          |
| `color` / `description` / `visibility` / `list_type` | text            | display + `pebbly-picks` type marker; `description` ≤150 chars; `visibility` is `public` \| `private` (public lists are what `/c/$id` shares) |
| `sort_type`                                          | text enum       | `unordered` \| `ordered`, default `unordered`; ordered lists render items by rank                                                             |
| `sort_order`                                         | integer         | default 0, drives list ordering in the watchlist UI                                                                                           |
| `created_at` / `updated_at`                          | integer         |                                                                                                                                               |

Indexes: `(user_id, name)` **unique** · `(user_id, sort_order)`.

### list_items

Membership of a title in a list.

| Column                                                       | Type            | Notes                                                                                                              |
| :----------------------------------------------------------- | :-------------- | :----------------------------------------------------------------------------------------------------------------- |
| `id`                                                         | text PK         |                                                                                                                    |
| `user_id`                                                    | text FK → users | cascade                                                                                                            |
| `list_id`                                                    | text FK → lists | cascade (deleting a list deletes its items)                                                                        |
| `tmdb_id` / `media_type`                                     | integer / enum  |                                                                                                                    |
| `position`                                                   | integer         | default 0; appends at `max(position) + 1`; drives ordering on `ordered` lists (reorder writes one UPDATE per item) |
| `added_at`                                                   | integer         |                                                                                                                    |
| `title` / `image` / `backdrop` / `overview` / `release_date` | text            | metadata snapshot                                                                                                  |
| `rating`                                                     | real            |                                                                                                                    |

Indexes: `(list_id, tmdb_id, media_type)` **unique** ·
`(user_id, tmdb_id, media_type)` (covers user-level lookups).

### ai_recommendations

One row per AI generation. Rate limiting lives in the separate
`rate_limit_attempts` ledger (see below), not here.

| Column                                                           | Type            | Notes                                        |
| :--------------------------------------------------------------- | :-------------- | :------------------------------------------- |
| `id`                                                             | text PK         |                                              |
| `user_id`                                                        | text FK → users | cascade                                      |
| `recommendations`                                                | text (json)     | final (possibly verified) list               |
| `original_recommendations`                                       | text (json)     | pre-verification snapshot                    |
| `watchlist_hash`                                                 | text            | legacy; no longer written (defaults to `""`) |
| `input_stats`                                                    | text (json)     | movie/tv/episode/total counts                |
| `model`                                                          | text            | Gemini model used                            |
| `media_type_preference` / `genre_preference` / `generation_type` | text            | generation inputs                            |
| `verified`                                                       | boolean         | TMDB verification completed                  |
| `created_at`                                                     | integer         |                                              |

Index: `(user_id, created_at)`.

### rate_limit_attempts

Generic rate-limit ledger keyed by attempt (`ai-gen:<userId>`,
`ai-homepage:<userId>`). Each row is one consumed attempt slot; rows older
than the window are pruned on every check. See `helpers/rate-limit.ts`.

| Column       | Type    | Notes                   |
| :----------- | :------ | :---------------------- |
| `id`         | text PK | reservation token       |
| `key`        | text    | limiter key             |
| `created_at` | integer | ms epoch of the attempt |

Index: `(key, created_at)`.

### homepage_recommendations

The "Picks For You" widget state, one row per user.

| Column                                  | Type                        | Notes                           |
| :-------------------------------------- | :-------------------------- | :------------------------------ |
| `id`                                    | text PK                     |                                 |
| `user_id`                               | text FK → users, **unique** | one row per user                |
| `recommendations`                       | text (json)                 | current picks                   |
| `previous_recommendations`              | text (json)                 | previous set (for rotation)     |
| `last_attempted_at` / `last_updated_at` | integer                     | ms epoch                        |
| `status`                                | text                        | `none` \| `success` \| `failed` |

The 24 h refresh + 1 h failure-retry logic is driven by
`last_attempted_at`/`status` (see `fns/recommendations.ts`).

### recommendation_feedback

Thumbs up/down on recommended titles, trains future generations.

| Column                   | Type            | Notes                                   |
| :----------------------- | :-------------- | :-------------------------------------- |
| `id`                     | text PK         |                                         |
| `user_id`                | text FK → users | cascade                                 |
| `tmdb_id` / `media_type` | integer / enum  |                                         |
| `title`                  | text            |                                         |
| `feedback`               | text enum       | `like` \| `not_interested` \| `dislike` |
| `updated_at`             | integer         |                                         |

Indexes: `(user_id, tmdb_id, media_type)` **unique** ·
`(user_id, feedback)` (drives homepage/generation exclusion lookups).

### role_permissions

RBAC feature flags, including the `global` kill switch.

| Column    | Type    | Notes                                           |
| :-------- | :------ | :---------------------------------------------- |
| `role`    | text    | `global` \| `video-player` \| `ai-integrations` |
| `feature` | text    | `video-player` \| `ai-recommendations`          |
| `enabled` | boolean | default `true`                                  |

Primary key: `(role, feature)`. Seeded/defaulted by `syncRolePermissions`
(see [server-layer.md](./server-layer.md#5-rbac-srcserverrbacts)).

### snapshot_cursors

Keyset-pagination cursor for the daily cron task.

| Column       | Type    | Notes                            |
| :----------- | :------ | :------------------------------- |
| `key`        | text PK | e.g. `watchlist_snapshot_cursor` |
| `value`      | text    | last processed user id           |
| `updated_at` | integer |                                  |

## Migrations (`drizzle/`)

| Migration                     | What changed                                                                                                                              |
| :---------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `0000_dear_warbound.sql`      | Initial schema, all tables, indexes, checks. `users` still had `is_admin`                                                                 |
| `0001_slippery_cammi.sql`     | Table rebuilds: `role_permissions` gets a real composite PK; `list_items.rating` and `watch_items.rating` switch from `integer` to `real` |
| `0002_cute_bloodstrike.sql`   | Adds `snapshot_cursors`                                                                                                                   |
| `0003_petite_sugar_man.sql`   | Drops `users.is_admin` (admin now read from Clerk only)                                                                                   |
| `0004_wise_sabretooth.sql`    | Adds `users.watchlist_rev`, watchlist change-detection counter                                                                            |
| `0005_yellow_rafael_vega.sql` | Adds `users.lists_rev` and `users.ai_rev`, lists + AI history counters                                                                    |
| `0006_wild_iron_man.sql`      | Adds `users.perms_rev`, RBAC change-detection counter (role/ban/flag changes propagate through the same version poll)                     |
| `0007_misty_vance_astro.sql`  | Collections support: adds `list_items.position`, `lists.description`, and `lists.sort_type` (public shareable lists with ranked ordering) |

> `drizzle-kit generate` (via `drizzle.config.ts`) produces these from the
> schema. They are applied to D1 with `wrangler d1 migrations apply`, so the
> config needs no live DB connection.

## Data-integrity rules enforced in code, not in the schema

- **Concurrent first sign-in**, `requireUser` inserts with
  `onConflictDoNothing` and re-reads the canonical row, so two parallel
  requests for a brand-new user can't 500 on the unique `token_identifier`.
- **Concurrent watch-item upsert**, `upsertWatchItem` uses
  `onConflictDoUpdate` on `(user_id, tmdb_id, media_type)` so a write that
  loses the race still applies its state to the winner's row.
- **Duplicate-name lists**, unique index + `onConflictDoNothing` turns a race
  into a clean `CONFLICT`.
- **Bounded batches**, every multi-statement write uses `runBatch` (one D1
  round trip) and chunks at ≤100 statements; episode INSERTs chunk at 14 rows
  (7 bound params each) to respect D1's 100-parameter cap.
