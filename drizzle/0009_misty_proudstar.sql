CREATE TABLE `ai_generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`params` text NOT NULL,
	`recommendations` text,
	`input_stats` text,
	`model` text,
	`error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gen_jobs_user_created_idx` ON `ai_generation_jobs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `gen_jobs_status_idx` ON `ai_generation_jobs` (`status`);