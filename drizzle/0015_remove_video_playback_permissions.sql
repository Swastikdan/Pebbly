-- Intentional cleanup: video-player feature was removed from the codebase.
-- Audit before/after applying: SELECT count(*) FROM `role_permissions` WHERE `role` = 'video-player' OR `feature` = 'video-player';
DELETE FROM `role_permissions` WHERE `role` = 'video-player' OR `feature` = 'video-player';
