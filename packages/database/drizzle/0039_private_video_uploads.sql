ALTER TABLE `private_attachment_uploads`
  MODIFY COLUMN `type` enum('audio','document','video') NOT NULL;
