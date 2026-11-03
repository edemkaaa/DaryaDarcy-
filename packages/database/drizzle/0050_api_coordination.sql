CREATE TABLE `api_rate_limits` (
  `kind` enum('rate','login') NOT NULL,
  `keyHash` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `attempts` bigint unsigned NOT NULL,
  `expiresAt` bigint unsigned NOT NULL,
  `nextAllowedAt` bigint unsigned NOT NULL DEFAULT 0,
  `generation` varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`kind`,`keyHash`),
  KEY `api_rate_limits_expiry` (`kind`,`expiresAt`)
) ENGINE=InnoDB;
