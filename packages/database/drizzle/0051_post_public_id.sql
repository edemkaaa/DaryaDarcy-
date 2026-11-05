ALTER TABLE `posts` ADD COLUMN `publicId` varchar(36) NULL;
--> statement-breakpoint
ALTER TABLE `posts`
  ALTER COLUMN `publicId` SET DEFAULT (
    LOWER(CONCAT(
      HEX(RANDOM_BYTES(4)), '-', HEX(RANDOM_BYTES(2)), '-4',
      RIGHT(HEX(RANDOM_BYTES(2)), 3), '-',
      SUBSTRING('89ab', 1 + (ORD(RANDOM_BYTES(1)) & 3), 1),
      RIGHT(HEX(RANDOM_BYTES(2)), 3), '-', HEX(RANDOM_BYTES(6))
    ))
  );
--> statement-breakpoint
UPDATE `posts` SET `publicId` = DEFAULT, `updatedAt` = `updatedAt` WHERE `publicId` IS NULL;
--> statement-breakpoint
ALTER TABLE `posts`
  MODIFY COLUMN `publicId` varchar(36) NOT NULL DEFAULT (
    LOWER(CONCAT(
      HEX(RANDOM_BYTES(4)), '-', HEX(RANDOM_BYTES(2)), '-4',
      RIGHT(HEX(RANDOM_BYTES(2)), 3), '-',
      SUBSTRING('89ab', 1 + (ORD(RANDOM_BYTES(1)) & 3), 1),
      RIGHT(HEX(RANDOM_BYTES(2)), 3), '-', HEX(RANDOM_BYTES(6))
    ))
  ),
  ADD UNIQUE KEY `posts_public_id_unique` (`publicId`);
