ALTER TABLE `access_email_outbox`
  ADD COLUMN `discardedAt` timestamp NULL,
  ADD COLUMN `lastError` varchar(64) NULL;
