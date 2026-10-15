CREATE INDEX `likes_post_lookup` ON `likes` (`postId`);
--> statement-breakpoint
CREATE INDEX `post_comments_post_created` ON `post_comments` (`postId`,`createdAt`);
