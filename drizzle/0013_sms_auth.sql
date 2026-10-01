ALTER TABLE `users` ADD COLUMN `phone` varchar(16) NULL;
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);

CREATE TABLE IF NOT EXISTS `sms_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(16) NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`ip` varchar(45) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp NULL,
	CONSTRAINT `sms_codes_id` PRIMARY KEY(`id`),
	INDEX `sms_codes_phone_created` (`phone`, `createdAt`),
	INDEX `sms_codes_ip_created` (`ip`, `createdAt`)
);
