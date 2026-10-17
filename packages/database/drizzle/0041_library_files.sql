ALTER TABLE `private_content_files` MODIFY `usage` enum('postPhoto','articlePhoto','articleDocument','commentPhoto','libraryPhoto','libraryDocument') NOT NULL;
--> statement-breakpoint
ALTER TABLE `private_content_files` MODIFY `parentKind` enum('post','article','comment','library');
--> statement-breakpoint
CREATE TABLE `library_file_bindings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `materialKey` varchar(32) NOT NULL,
  `fileKey` varchar(64) NOT NULL,
  `assetId` varchar(36) NOT NULL,
  `sortOrder` int NOT NULL,
  `enabled` boolean NOT NULL DEFAULT FALSE,
  `revision` int NOT NULL,
  UNIQUE KEY `library_file_slot_unique` (`materialKey`,`fileKey`),
  UNIQUE KEY `library_file_asset_unique` (`assetId`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `library_file_migrations` (
  `requestKey` varchar(64) PRIMARY KEY,
  `payloadHash` varchar(64) NOT NULL,
  `plan` json NOT NULL,
  `state` enum('pending','committed','rolledBack') NOT NULL DEFAULT 'pending',
  `previous` json,
  `result` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
