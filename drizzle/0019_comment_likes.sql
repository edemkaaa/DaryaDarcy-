CREATE TABLE IF NOT EXISTS `comment_likes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `commentId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `comment_likes_id` PRIMARY KEY(`id`),
  CONSTRAINT `comment_likes_unique` UNIQUE(`userId`,`commentId`)
);
