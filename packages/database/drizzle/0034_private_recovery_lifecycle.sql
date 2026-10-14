ALTER TABLE `private_attachment_uploads`
  ADD COLUMN `recoveryCompactedAt` timestamp NULL,
  ADD COLUMN `orphanedAt` timestamp NULL;
