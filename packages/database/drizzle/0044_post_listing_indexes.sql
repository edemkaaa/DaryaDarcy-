-- An explicit DATETIME cast avoids MySQL functional-index truncation when
-- publishedAt is NULL and createdAt comes from its CURRENT_TIMESTAMP default.
ALTER TABLE `posts`
  ADD INDEX `posts_feed_listing_idx` (`published`, `status`, `sortOrder`, (CAST(COALESCE(`publishedAt`, `createdAt`) AS DATETIME)) DESC, `id` ASC),
  ADD INDEX `posts_club_listing_idx` (`published`, `status`, (CAST(COALESCE(`publishedAt`, `createdAt`) AS DATETIME)) DESC, `id` ASC),
  ALGORITHM=INPLACE, LOCK=SHARED;
