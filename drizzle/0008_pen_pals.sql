CREATE TABLE IF NOT EXISTS `pen_pal_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`city` varchar(128) NOT NULL,
	`interests` json NOT NULL,
	`address` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pen_pal_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `pen_pal_profiles_userId` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pen_pal_shown` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`matchUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pen_pal_shown_id` PRIMARY KEY(`id`),
	CONSTRAINT `pen_pal_shown_pair` UNIQUE(`userId`,`matchUserId`)
);
