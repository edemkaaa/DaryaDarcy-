CREATE TABLE `public_photo_uploads` (
  `requestId` varchar(64) NOT NULL PRIMARY KEY,
  `actorUserId` int,
  `purpose` enum('avatar','publicCover') NOT NULL,
  `assetId` varchar(36) NOT NULL,
  `payloadHash` varchar(64) NOT NULL,
  `outputHash` varchar(64) NOT NULL,
  `namespaceHash` varchar(64) NOT NULL,
  `fileSize` int NOT NULL,
  `expectedAvatarUrl` text,
  `state` enum('pending','ready') NOT NULL DEFAULT 'pending',
  `url` text,
  `avatarApplied` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `public_photo_asset` (`assetId`),
  KEY `public_photo_owner` (`actorUserId`)
) ENGINE=InnoDB;
