ALTER TABLE `list_items` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lists` ADD `description` text;--> statement-breakpoint
ALTER TABLE `lists` ADD `sort_type` text DEFAULT 'unordered' NOT NULL;