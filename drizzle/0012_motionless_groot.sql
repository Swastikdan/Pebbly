CREATE TABLE `account_deletion_requests` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` integer NOT NULL,
	`scheduled_for` integer NOT NULL,
	`canceled_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_deletion_status_idx` ON `account_deletion_requests` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `release_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`title` text,
	`release_date` text,
	`region` text DEFAULT 'US' NOT NULL,
	`notify_release` integer DEFAULT true NOT NULL,
	`notify_availability` integer DEFAULT true NOT NULL,
	`availability_hash` text,
	`last_checked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `release_subscription_user_media_uq` ON `release_subscriptions` (`user_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `release_subscription_user_idx` ON `release_subscriptions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_notifications_user_dedupe_uq` ON `user_notifications` (`user_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `user_notifications_user_created_idx` ON `user_notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `watch_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`season` integer,
	`episode` integer,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`watched_seconds` integer DEFAULT 0 NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watch_sessions_user_created_idx` ON `watch_sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `watch_sessions_user_media_idx` ON `watch_sessions` (`user_id`,`media_type`,`tmdb_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `watchlist_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`action` text NOT NULL,
	`title` text,
	`image` text,
	`rating` real,
	`release_date` text,
	`overview` text,
	`previous_status` text,
	`next_status` text,
	`previous_reaction` text,
	`next_reaction` text,
	`previous_progress` integer,
	`next_progress` integer,
	`created_at` integer NOT NULL,
	`reverted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watchlist_activity_user_created_idx` ON `watchlist_activity` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `watchlist_activity_user_media_idx` ON `watchlist_activity` (`user_id`,`media_type`,`tmdb_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `list_items_list_position_idx` ON `list_items` (`list_id`,`position`,`added_at`,`id`);--> statement-breakpoint
CREATE INDEX `list_items_list_search_idx` ON `list_items` (`list_id`,`title`);--> statement-breakpoint
CREATE INDEX `watch_items_user_watchlist_updated_idx` ON `watch_items` (`user_id`,`in_watchlist`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `watch_items_user_watchlist_media_idx` ON `watch_items` (`user_id`,`in_watchlist`,`media_type`,`updated_at`,`id`);