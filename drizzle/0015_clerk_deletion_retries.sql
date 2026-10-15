CREATE TABLE `clerk_deletion_retries` (
	`clerk_user_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`first_failed_at` integer NOT NULL,
	`last_attempted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clerk_deletion_retries_attempted_idx` ON `clerk_deletion_retries` (`last_attempted_at`);
