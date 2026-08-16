CREATE TABLE `ai_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recommendations` text NOT NULL,
	`original_recommendations` text,
	`watchlist_hash` text DEFAULT '' NOT NULL,
	`input_stats` text NOT NULL,
	`model` text NOT NULL,
	`media_type_preference` text,
	`genre_preference` text,
	`generation_type` text,
	`verified` integer DEFAULT false,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_recs_user_created_idx` ON `ai_recommendations` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `episode_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`season` integer NOT NULL,
	`episode` integer NOT NULL,
	`is_watched` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episode_user_season_ep_uq` ON `episode_progress` (`user_id`,`tmdb_id`,`season`,`episode`);--> statement-breakpoint
CREATE TABLE `homepage_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recommendations` text NOT NULL,
	`previous_recommendations` text,
	`last_attempted_at` integer DEFAULT 0 NOT NULL,
	`last_updated_at` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'none' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homepage_recommendations_user_id_unique` ON `homepage_recommendations` (`user_id`);--> statement-breakpoint
CREATE TABLE `list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`list_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`added_at` integer NOT NULL,
	`title` text,
	`image` text,
	`backdrop` text,
	`rating` integer,
	`release_date` text,
	`overview` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `list_items_list_media_uq` ON `list_items` (`list_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `list_items_user_media_idx` ON `list_items` (`user_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`visibility` text,
	`list_type` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lists_user_name_uq` ON `lists` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `lists_user_sort_idx` ON `lists` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `recommendation_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`title` text NOT NULL,
	`feedback` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_user_media_uq` ON `recommendation_feedback` (`user_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `feedback_user_feedback_idx` ON `recommendation_feedback` (`user_id`,`feedback`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role` text NOT NULL,
	`feature` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `role_permissions_pk` ON `role_permissions` (`role`,`feature`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`token_identifier` text NOT NULL,
	`name` text,
	`image` text,
	`email` text,
	`roles` text DEFAULT '[]',
	`is_admin` integer DEFAULT false,
	`is_banned` integer DEFAULT false
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_token_identifier_unique` ON `users` (`token_identifier`);--> statement-breakpoint
CREATE TABLE `watch_items` (
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
	`rating` integer,
	`release_date` text,
	`overview` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "watch_items_progress_range" CHECK("watch_items"."progress" between 0 and 100),
	CONSTRAINT "watch_items_rating_range" CHECK("watch_items"."rating" between 0 and 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watch_items_user_media_uq` ON `watch_items` (`user_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `watch_items_user_status_idx` ON `watch_items` (`user_id`,`progress_status`);--> statement-breakpoint
CREATE INDEX `watch_items_user_updated_idx` ON `watch_items` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `watchlist_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`items` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `snapshots_user_created_idx` ON `watchlist_snapshots` (`user_id`,`created_at`);