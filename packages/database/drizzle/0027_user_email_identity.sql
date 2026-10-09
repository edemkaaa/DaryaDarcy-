CREATE UNIQUE INDEX `users_email_identity_unique`
  ON `users` ((NULLIF(LOWER(TRIM(`email`)), '')));
