CREATE TABLE IF NOT EXISTS `push_consent_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`consentType` enum('service','marketing') NOT NULL,
	`status` enum('granted','revoked') NOT NULL,
	`consentVersion` varchar(32) NOT NULL,
	`platform` varchar(16) NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_consent_events_id` PRIMARY KEY(`id`),
	INDEX `push_consent_events_user_type_created` (`userId`, `consentType`, `createdAt`)
);
