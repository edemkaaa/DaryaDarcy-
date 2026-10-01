ALTER TABLE `posts` ADD COLUMN `publishedAt` timestamp NULL;
UPDATE `posts` SET `publishedAt` = `createdAt` WHERE `publishedAt` IS NULL;
