CREATE TABLE `push_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(256) NOT NULL,
	`userId` int,
	`platform` varchar(16),
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `push_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_tokens_token_unique` UNIQUE(`token`)
);
