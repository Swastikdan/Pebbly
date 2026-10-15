-- Backfill-safe: existing rows get '' since SQLite/D1 aborts ADD COLUMN ... NOT NULL without a default on non-empty tables.
ALTER TABLE `account_deletion_requests` ADD `clerk_user_id` text NOT NULL DEFAULT '';
