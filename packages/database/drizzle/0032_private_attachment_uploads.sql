CREATE TABLE `private_attachment_uploads` (
  `requestKey` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `actorUserId` int NOT NULL,
  `assetId` varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `payloadHash` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `namespaceHash` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `type` enum('audio','document') NOT NULL,
  `filename` varchar(512) NOT NULL,
  `mimeType` varchar(128) NOT NULL,
  `fileSize` int NOT NULL,
  `state` enum('pending','ready') NOT NULL DEFAULT 'pending',
  `etag` varchar(128) NULL,
  `postId` int NULL,
  `mediaId` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`requestKey`),
  UNIQUE KEY `private_attachment_asset_unique` (`assetId`),
  UNIQUE KEY `private_attachment_media_unique` (`mediaId`)
) ENGINE=InnoDB;
