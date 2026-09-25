CREATE TABLE `user_taste_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`adventure_level` text DEFAULT 'balanced' NOT NULL,
	`preferred_genres` text DEFAULT '[]' NOT NULL,
	`disliked_genres` text DEFAULT '[]' NOT NULL,
	`disliked_themes` text DEFAULT '[]' NOT NULL,
	`avoid_titles` text DEFAULT '[]' NOT NULL,
	`preferred_media_type` text DEFAULT 'all' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "user_taste_adventure_ck" CHECK("user_taste_profiles"."adventure_level" in ('familiar', 'balanced', 'adventurous')),
	CONSTRAINT "user_taste_media_type_ck" CHECK("user_taste_profiles"."preferred_media_type" in ('all', 'movie', 'tv'))
);
