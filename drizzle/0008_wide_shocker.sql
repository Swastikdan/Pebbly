CREATE TABLE `rate_limit_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_key_created_idx` ON `rate_limit_attempts` (`key`,`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
INSERT INTO `__new_homepage_recommendations`("id", "user_id", "recommendations", "previous_recommendations", "last_attempted_at", "last_updated_at", "status") SELECT "id", "user_id", "recommendations", "previous_recommendations", "last_attempted_at", "last_updated_at", "status" FROM `homepage_recommendations`;--> statement-breakpoint
DROP TABLE `homepage_recommendations`;--> statement-breakpoint
ALTER TABLE `__new_homepage_recommendations` RENAME TO `homepage_recommendations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
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
INSERT INTO `__new_lists`("id", "user_id", "name", "color", "description", "visibility", "list_type", "sort_type", "sort_order", "created_at", "updated_at") SELECT "id", "user_id", "name", "color", "description", "visibility", "list_type", "sort_type", "sort_order", "created_at", "updated_at" FROM `lists`;--> statement-breakpoint
DROP TABLE `lists`;--> statement-breakpoint
ALTER TABLE `__new_lists` RENAME TO `lists`;--> statement-breakpoint
CREATE UNIQUE INDEX `lists_user_name_uq` ON `lists` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `lists_user_sort_idx` ON `lists` (`user_id`,`sort_order`);