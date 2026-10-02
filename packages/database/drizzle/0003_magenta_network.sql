CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`youtubeId` varchar(32) NOT NULL,
	`title` varchar(512) NOT NULL,
	`duration` varchar(16),
	`thumbnailUrl` text,
	`videoUrl` text,
	`views` varchar(32),
	`publishedText` varchar(64),
	`sortOrder` int NOT NULL DEFAULT 0,
	`published` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `videos_youtubeId_unique` UNIQUE(`youtubeId`)
);
