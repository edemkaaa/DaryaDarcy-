CREATE TABLE `comment_creation_requests` (
  `requestKey` varchar(64) NOT NULL,
  `actorUserId` int,
  `payloadHash` varchar(64) NOT NULL,
  `claimToken` varchar(36) NOT NULL,
  `commentId` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`requestKey`),
  KEY `comment_creation_owner_key` (`actorUserId`,`requestKey`)
) ENGINE=InnoDB;
