CREATE TABLE `content_recovery_markers` (
  `kind` enum('post','article','private_attachment') NOT NULL,
  `requestKey` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `actorUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL,
  PRIMARY KEY (`kind`,`requestKey`),
  KEY `content_recovery_marker_owner` (`actorUserId`,`createdAt`)
) ENGINE=InnoDB;
--> statement-breakpoint
ALTER TABLE `post_creation_requests` ADD INDEX `post_creation_retention` (`createdAt`,`requestKey`);
--> statement-breakpoint
ALTER TABLE `article_creation_requests` ADD INDEX `article_creation_retention` (`createdAt`,`requestKey`);
--> statement-breakpoint
ALTER TABLE `private_attachment_uploads` ADD INDEX `private_attachment_retention` (`createdAt`,`requestKey`);
