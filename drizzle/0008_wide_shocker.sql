CREATE TABLE `rate_limit_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_key_created_idx` ON `rate_limit_attempts` (`key`,`created_at`);--> statement-breakpoint
-- NOTE: deliberately no `PRAGMA foreign_keys=OFF` here. D1 ignores it (and
-- locally it would mask bugs); the lists rebuild below instead detaches
-- `list_items` first so dropping `lists` cannot cascade-delete its rows.
CREATE TABLE `__new_homepage_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recommendations` text NOT NULL,
	`previous_recommendations` text,
	`last_attempted_at` integer DEFAULT 0 NOT NULL,
	`last_updated_at` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'none' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "homepage_rec_status_ck" CHECK("__new_homepage_recommendations"."status" in ('none', 'success', 'failed'))
);
--> statement-breakpoint
-- Normalize legacy free-form status values: anything outside the CHECK's
-- allowed set falls back to 'none' so pre-constraint rows can't fail the copy.
INSERT INTO `__new_homepage_recommendations`("id", "user_id", "recommendations", "previous_recommendations", "last_attempted_at", "last_updated_at", "status") SELECT "id", "user_id", "recommendations", "previous_recommendations", "last_attempted_at", "last_updated_at", CASE WHEN "status" IN ('none', 'success', 'failed') THEN "status" ELSE 'none' END FROM `homepage_recommendations`;--> statement-breakpoint
DROP TABLE `homepage_recommendations`;--> statement-breakpoint
ALTER TABLE `__new_homepage_recommendations` RENAME TO `homepage_recommendations`;--> statement-breakpoint
CREATE UNIQUE INDEX `homepage_recommendations_user_id_unique` ON `homepage_recommendations` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`description` text,
	`visibility` text,
	`list_type` text,
	`sort_type` text DEFAULT 'unordered' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lists_visibility_ck" CHECK("__new_lists"."visibility" in ('public', 'private')),
	CONSTRAINT "lists_list_type_ck" CHECK("__new_lists"."list_type" in ('custom', 'pebbly-picks'))
);
--> statement-breakpoint
-- Detach list_items before touching `lists`: stash its rows in an FK-free
-- table, then drop the child table itself. With no child rows left referencing
-- `lists`, DROP TABLE cannot cascade-delete anything (with foreign_keys on -
-- as D1 always runs - dropping the parent would otherwise wipe every
-- list_items row).
CREATE TABLE `__stash_list_items` AS SELECT "id", "user_id", "list_id", "tmdb_id", "media_type", "position", "added_at", "title", "image", "backdrop", "rating", "release_date", "overview" FROM `list_items`;--> statement-breakpoint
DROP TABLE `list_items`;--> statement-breakpoint
-- Normalize legacy free-form enum values before they meet the new CHECKs:
-- unknown visibility falls back to 'private' and unknown list_type to
-- 'custom'; NULL (unset) stays NULL, which both CHECKs accept.
INSERT INTO `__new_lists`("id", "user_id", "name", "color", "description", "visibility", "list_type", "sort_type", "sort_order", "created_at", "updated_at") SELECT "id", "user_id", "name", "color", "description", CASE WHEN "visibility" IS NULL OR "visibility" IN ('public', 'private') THEN "visibility" ELSE 'private' END, CASE WHEN "list_type" IS NULL OR "list_type" IN ('custom', 'pebbly-picks') THEN "list_type" ELSE 'custom' END, "sort_type", "sort_order", "created_at", "updated_at" FROM `lists`;--> statement-breakpoint
DROP TABLE `lists`;--> statement-breakpoint
ALTER TABLE `__new_lists` RENAME TO `lists`;--> statement-breakpoint
CREATE TABLE `list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`list_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`added_at` integer NOT NULL,
	`title` text,
	`image` text,
	`backdrop` text,
	`rating` real,
	`release_date` text,
	`overview` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `list_items`("id", "user_id", "list_id", "tmdb_id", "media_type", "position", "added_at", "title", "image", "backdrop", "rating", "release_date", "overview") SELECT "id", "user_id", "list_id", "tmdb_id", "media_type", "position", "added_at", "title", "image", "backdrop", "rating", "release_date", "overview" FROM `__stash_list_items`;--> statement-breakpoint
DROP TABLE `__stash_list_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `list_items_list_media_uq` ON `list_items` (`list_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `list_items_user_media_idx` ON `list_items` (`user_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `lists_user_name_uq` ON `lists` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `lists_user_sort_idx` ON `lists` (`user_id`,`sort_order`)
