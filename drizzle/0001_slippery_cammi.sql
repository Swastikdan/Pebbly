PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_role_permissions` (
	`role` text NOT NULL,
	`feature` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`role`, `feature`)
);
--> statement-breakpoint
INSERT INTO `__new_role_permissions`("role", "feature", "enabled") SELECT "role", "feature", "enabled" FROM `role_permissions`;--> statement-breakpoint
DROP TABLE `role_permissions`;--> statement-breakpoint
ALTER TABLE `__new_role_permissions` RENAME TO `role_permissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`list_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
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
INSERT INTO `__new_list_items`("id", "user_id", "list_id", "tmdb_id", "media_type", "added_at", "title", "image", "backdrop", "rating", "release_date", "overview") SELECT "id", "user_id", "list_id", "tmdb_id", "media_type", "added_at", "title", "image", "backdrop", "rating", "release_date", "overview" FROM `list_items`;--> statement-breakpoint
DROP TABLE `list_items`;--> statement-breakpoint
ALTER TABLE `__new_list_items` RENAME TO `list_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `list_items_list_media_uq` ON `list_items` (`list_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `list_items_user_media_idx` ON `list_items` (`user_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE TABLE `__new_watch_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`in_watchlist` integer DEFAULT false,
	`progress_status` text,
	`reaction` text,
	`progress` integer DEFAULT 0,
	`title` text,
	`image` text,
	`rating` real,
	`release_date` text,
	`overview` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "watch_items_progress_range" CHECK("__new_watch_items"."progress" between 0 and 100),
	CONSTRAINT "watch_items_rating_range" CHECK("__new_watch_items"."rating" between 0 and 10)
);
--> statement-breakpoint
INSERT INTO `__new_watch_items`("id", "user_id", "tmdb_id", "media_type", "in_watchlist", "progress_status", "reaction", "progress", "title", "image", "rating", "release_date", "overview", "updated_at") SELECT "id", "user_id", "tmdb_id", "media_type", "in_watchlist", "progress_status", "reaction", "progress", "title", "image", "rating", "release_date", "overview", "updated_at" FROM `watch_items`;--> statement-breakpoint
DROP TABLE `watch_items`;--> statement-breakpoint
ALTER TABLE `__new_watch_items` RENAME TO `watch_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `watch_items_user_media_uq` ON `watch_items` (`user_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `watch_items_user_status_idx` ON `watch_items` (`user_id`,`progress_status`);--> statement-breakpoint
CREATE INDEX `watch_items_user_updated_idx` ON `watch_items` (`user_id`,`updated_at`);