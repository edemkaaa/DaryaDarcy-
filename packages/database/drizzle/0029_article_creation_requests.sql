CREATE TABLE `article_creation_requests` (
  `requestKey` varchar(64) NOT NULL,
  `actorUserId` int NOT NULL,
  `payloadHash` varchar(64) NOT NULL,
  `claimToken` varchar(36) NOT NULL,
  `articleId` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`requestKey`)
) ENGINE=InnoDB;
