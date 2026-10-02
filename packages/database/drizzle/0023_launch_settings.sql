CREATE TABLE `launch_settings` (
  `id` int NOT NULL,
  `revision` int NOT NULL DEFAULT 0,
  `config` json NOT NULL,
  `updatedBy` int,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `launch_settings_id` PRIMARY KEY (`id`)
);
