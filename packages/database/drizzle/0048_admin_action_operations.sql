CREATE TABLE `admin_action_operations` (
  `actorUserId` int NOT NULL,
  `operationKey` varchar(36) NOT NULL,
  `kind` enum('grantClub','resendAccessEmail') NOT NULL,
  `targetUserId` int NOT NULL,
  `payloadHash` varchar(64) NOT NULL,
  `result` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`actorUserId`,`operationKey`),
  KEY `admin_action_target` (`targetUserId`)
) ENGINE=InnoDB;
