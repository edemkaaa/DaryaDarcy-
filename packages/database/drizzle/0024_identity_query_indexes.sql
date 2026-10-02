ALTER TABLE `users` ADD INDEX `users_email_lookup` (`email`);
--> statement-breakpoint
ALTER TABLE `access_email_outbox` ADD INDEX `access_email_outbox_user` (`userId`);
