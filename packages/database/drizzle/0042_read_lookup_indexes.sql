ALTER TABLE `likes` ADD INDEX `likes_user_post_lookup` (`userId`, `postId`), ALGORITHM=INPLACE, LOCK=NONE;
--> statement-breakpoint
ALTER TABLE `saved_posts` ADD INDEX `saved_posts_user_created` (`userId`, `createdAt`, `id`), ADD INDEX `saved_posts_user_post_created` (`userId`, `postId`, `createdAt`, `id`), ALGORITHM=INPLACE, LOCK=NONE;
--> statement-breakpoint
ALTER TABLE `post_media` ADD INDEX `post_media_post_order` (`postId`, `sortOrder`), ALGORITHM=INPLACE, LOCK=NONE;
