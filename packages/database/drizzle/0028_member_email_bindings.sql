CREATE TABLE `member_email_bindings` (
  `requestKey` varchar(36) NOT NULL,
  `payloadHash` varchar(64) NOT NULL,
  `actorUserId` int NOT NULL,
  `userId` int NOT NULL,
  `email` varchar(320),
  `proofHash` varchar(64),
  `state` enum('pending','confirmed','expired','cancelled') NOT NULL DEFAULT 'pending',
  `expiresAt` timestamp NOT NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`requestKey`),
  CONSTRAINT `member_email_bindings_proofHash_unique` UNIQUE (`proofHash`),
  INDEX `member_email_bindings_user_state` (`userId`,`state`),
  INDEX `member_email_bindings_retention` (`state`,`expiresAt`,`completedAt`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `member_email_binding_outbox` (
  `requestKey` varchar(36) NOT NULL,
  `tokenCipher` text,
  `sentAt` timestamp NULL,
  `discardedAt` timestamp NULL,
  `lastError` varchar(64),
  `nextAttemptAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `attempts` int NOT NULL DEFAULT 0,
  `leaseId` varchar(36),
  `leaseUntil` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`requestKey`),
  INDEX `member_email_binding_outbox_due` (`sentAt`,`nextAttemptAt`)
) ENGINE=InnoDB;
