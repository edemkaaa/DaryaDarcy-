ALTER TABLE `users` ADD COLUMN `sessionVersion` int NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `billing_receipts` (
  `paymentKey` varchar(64) PRIMARY KEY, `userId` int NOT NULL,
  `orderId` varchar(64) NOT NULL, `payloadHash` varchar(64) NOT NULL,
  `amountMinor` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `billing_profiles` (
  `profileKey` varchar(64) PRIMARY KEY, `userId` int NOT NULL,
  `domain` varchar(255) NOT NULL, `subscriptionId` varchar(64) NOT NULL,
  `profileId` varchar(64) NOT NULL, `email` varchar(320) NOT NULL, `amountMinor` int NOT NULL,
  `cancelRequestedAt` timestamp NULL, `cancelledAt` timestamp NULL,
  `attempts` int NOT NULL DEFAULT 0, `nextAttemptAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `leaseId` varchar(36) NULL, `leaseUntil` timestamp NULL,
  INDEX `billing_profiles_user` (`userId`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `password_tokens` (
  `id` int AUTO_INCREMENT PRIMARY KEY, `userId` int NOT NULL,
  `tokenHash` varchar(64) NOT NULL UNIQUE, `purpose` enum('setup','reset') NOT NULL,
  `expiresAt` timestamp NOT NULL, `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `password_tokens_user` (`userId`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `access_email_outbox` (
  `id` int AUTO_INCREMENT PRIMARY KEY, `eventKey` varchar(128) NOT NULL UNIQUE,
  `userId` int NOT NULL, `email` varchar(320) NOT NULL,
  `kind` enum('club-access','password-setup','password-reset') NOT NULL, `payload` json NOT NULL,
  `sentAt` timestamp NULL, `nextAttemptAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `attempts` int NOT NULL DEFAULT 0, `leaseId` varchar(36) NULL, `leaseUntil` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `access_email_outbox_due` (`sentAt`,`nextAttemptAt`)
) ENGINE=InnoDB;
