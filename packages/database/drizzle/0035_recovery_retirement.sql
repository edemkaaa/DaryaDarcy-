ALTER TABLE `private_attachment_uploads` MODIFY COLUMN `actorUserId` int NULL,
  ADD INDEX `private_attachment_owner_key` (`actorUserId`, `requestKey`);
--> statement-breakpoint
ALTER TABLE `post_creation_requests` ADD INDEX `post_creation_owner_key` (`actorUserId`, `requestKey`);
--> statement-breakpoint
ALTER TABLE `article_creation_requests` ADD INDEX `article_creation_owner_key` (`actorUserId`, `requestKey`);
--> statement-breakpoint
ALTER TABLE `content_recovery_markers` ADD INDEX `content_recovery_owner_key` (`actorUserId`, `kind`, `requestKey`);
