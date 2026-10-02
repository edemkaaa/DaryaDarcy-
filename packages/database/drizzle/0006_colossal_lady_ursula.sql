CREATE TABLE `post_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`type` enum('video','audio','document') NOT NULL,
	`url` text NOT NULL,
	`filename` varchar(512),
	`mimeType` varchar(128),
	`fileSize` int,
	`duration` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `status` enum('draft','scheduled','published') DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `target` enum('feed','club','both') DEFAULT 'feed' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `scheduledAt` timestamp;--> statement-breakpoint
ALTER TABLE `posts` ADD `richText` json;