ALTER TABLE `videos`
  MODIFY COLUMN `youtubeId` varchar(32) NULL,
  ADD COLUMN `provider` enum('youtube','vk') NOT NULL DEFAULT 'youtube',
  ADD COLUMN `access` enum('public','club') NOT NULL DEFAULT 'public',
  ADD COLUMN `vkEmbedUrl` text NULL,
  ADD COLUMN `vkSourceKey` varchar(64) NULL,
  ADD UNIQUE KEY `videos_vk_source_unique` (`vkSourceKey`);
