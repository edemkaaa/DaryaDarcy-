-- Users: moderation, blocking, account deletion request
ALTER TABLE `users`
  MODIFY COLUMN `role` enum('user','moderator','admin') NOT NULL DEFAULT 'user';

ALTER TABLE `users`
  ADD COLUMN `blockedAt` timestamp NULL DEFAULT NULL AFTER `role`,
  ADD COLUMN `blockedReason` varchar(512) NULL DEFAULT NULL AFTER `blockedAt`,
  ADD COLUMN `accountDeletionRequestedAt` timestamp NULL DEFAULT NULL AFTER `blockedReason`;

-- Pen pals: FIO + consent (city kept for legacy rows)
ALTER TABLE `pen_pal_profiles`
  ADD COLUMN `fullName` varchar(128) NULL DEFAULT NULL AFTER `userId`,
  ADD COLUMN `adultConsentAt` timestamp NULL DEFAULT NULL AFTER `address`,
  ADD COLUMN `consentVersion` varchar(32) NULL DEFAULT NULL AFTER `adultConsentAt`;

UPDATE `pen_pal_profiles` SET `fullName` = `city` WHERE `fullName` IS NULL OR `fullName` = '';

CREATE TABLE IF NOT EXISTS `pen_pal_matches` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userLowId` int NOT NULL,
  `userHighId` int NOT NULL,
  `initiatedBy` int NOT NULL,
  `userLowConfirmed` boolean NOT NULL DEFAULT false,
  `userHighConfirmed` boolean NOT NULL DEFAULT false,
  `mutualConfirmedAt` timestamp NULL DEFAULT NULL,
  `confirmDeadline` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `pen_pal_matches_id` PRIMARY KEY(`id`),
  CONSTRAINT `pen_pal_matches_pair` UNIQUE(`userLowId`,`userHighId`)
);

-- Comments: replies + photos
ALTER TABLE `post_comments`
  ADD COLUMN `parentId` int NULL DEFAULT NULL AFTER `postId`,
  ADD COLUMN `photos` json NULL DEFAULT NULL AFTER `text`;

CREATE TABLE IF NOT EXISTS `comment_reports` (
  `id` int AUTO_INCREMENT NOT NULL,
  `commentId` int NOT NULL,
  `reporterUserId` int NOT NULL,
  `reason` varchar(512) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `comment_reports_id` PRIMARY KEY(`id`),
  CONSTRAINT `comment_reports_unique` UNIQUE(`commentId`,`reporterUserId`)
);

-- General consent audit (PD, pen pals, etc.)
CREATE TABLE IF NOT EXISTS `user_consent_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `consentKey` varchar(64) NOT NULL,
  `status` enum('granted','revoked') NOT NULL,
  `consentVersion` varchar(32) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `user_consent_events_id` PRIMARY KEY(`id`)
);

-- Admin / moderator audit log
CREATE TABLE IF NOT EXISTS `admin_audit_log` (
  `id` int AUTO_INCREMENT NOT NULL,
  `actorUserId` int NOT NULL,
  `action` varchar(64) NOT NULL,
  `targetType` varchar(32) NOT NULL,
  `targetId` int NULL DEFAULT NULL,
  `details` text NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);

-- Shop delivery email queue
CREATE TABLE IF NOT EXISTS `shop_delivery_emails` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` varchar(128) NOT NULL,
  `userId` int NULL DEFAULT NULL,
  `email` varchar(320) NOT NULL,
  `productId` varchar(64) NOT NULL,
  `sentAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `shop_delivery_emails_id` PRIMARY KEY(`id`),
  CONSTRAINT `shop_delivery_emails_order` UNIQUE(`orderId`)
);
