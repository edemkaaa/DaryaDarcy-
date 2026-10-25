import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, unique, index, uniqueIndex, primaryKey } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import type { RichTextBlock, RichTextInline } from "../../shared/src/rich-text-types";
import type { LaunchConfiguration } from "../../shared/src/launch-settings";

export const launchSettings = mysqlTable("launch_settings", {
  id: int("id").primaryKey(),
  revision: int("revision").default(0).notNull(),
  config: json("config").$type<LaunchConfiguration>().notNull(),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type { RichTextBlock, RichTextInline } from "../../shared/src/rich-text-types";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 16 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  sessionVersion: int("sessionVersion").default(0).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  gender: mysqlEnum("gender", ["female", "male"]),
  avatarUrl: text("avatarUrl"),
  role: mysqlEnum("role", ["user", "moderator", "admin"]).default("user").notNull(),
  blockedAt: timestamp("blockedAt"),
  blockedReason: varchar("blockedReason", { length: 512 }),
  accountDeletionRequestedAt: timestamp("accountDeletionRequestedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [
  index("users_email_lookup").on(table.email),
  // NULL and empty legacy addresses do not claim an identity.
  uniqueIndex("users_email_identity_unique").on(sql`(NULLIF(LOWER(TRIM(${table.email})), ''))`),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Feed: Posts ──
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  /** Post text content (supports multiline, markdown-like) */
  text: text("text").notNull(),
  /** JSON array of photo URLs */
  photos: json("photos").$type<string[]>().notNull(),
  /** JSON array of tag slugs assigned to this post */
  tags: json("tags").$type<string[]>().notNull(),
  /** Source of the post: manual, instagram import, etc. */
  source: varchar("source", { length: 32 }).default("manual").notNull(),
  /** Instagram post ID for deduplication during import */
  instagramId: varchar("instagramId", { length: 128 }),
  /** Display order (lower = shown first); defaults to timestamp-based */
  sortOrder: int("sortOrder").default(0).notNull(),
  /** Whether the post is published (visible in feed) — legacy field, use status instead */
  published: boolean("published").default(true).notNull(),
  /** Post status: draft, scheduled, published */
  status: mysqlEnum("status", ["draft", "scheduled", "published"]).default("published").notNull(),
  /** Target feed: feed, club, or both */
  target: mysqlEnum("target", ["feed", "club", "both"]).default("feed").notNull(),
  /** Scheduled publication date (null if not scheduled) */
  scheduledAt: timestamp("scheduledAt"),
  /** Display/sort date shown in feed and club (backdating supported) */
  publishedAt: timestamp("publishedAt"),
  /** Rich text content (JSON format with formatting marks) */
  richText: json("richText").$type<RichTextBlock[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Post status: draft, scheduled, published */
export type PostStatus = "draft" | "scheduled" | "published";
/** Target feed: feed, club, or both */
export type PostTarget = "feed" | "club" | "both";

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

// A committed request survives post edits/deletion so a late retry cannot recreate it.
export const postCreationRequests = mysqlTable("post_creation_requests", {
  requestKey: varchar("requestKey", { length: 64 }).primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  postId: int("postId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("post_creation_retention").on(table.createdAt, table.requestKey), index("post_creation_owner_key").on(table.actorUserId, table.requestKey)]);

// Keep committed results after article deletion: replay must never resurrect it.
export const articleCreationRequests = mysqlTable("article_creation_requests", {
  requestKey: varchar("requestKey", { length: 64 }).primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  claimToken: varchar("claimToken", { length: 36 }).notNull(),
  articleId: int("articleId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("article_creation_retention").on(table.createdAt, table.requestKey), index("article_creation_owner_key").on(table.actorUserId, table.requestKey)]);

// Expired intents remain spent after their detailed recovery row is compacted.
export const contentRecoveryMarkers = mysqlTable("content_recovery_markers", {
  kind: mysqlEnum("kind", ["post", "article", "private_attachment"]).notNull(),
  requestKey: varchar("requestKey", { length: 64 }).notNull(),
  actorUserId: int("actorUserId").notNull(),
  createdAt: timestamp("createdAt").notNull(),
}, table => [
  primaryKey({ columns: [table.kind, table.requestKey] }),
  index("content_recovery_marker_owner").on(table.actorUserId, table.createdAt),
  index("content_recovery_owner_key").on(table.actorUserId, table.kind, table.requestKey),
]);

// ── Post Media (video, audio, documents — photos stay in posts.photos for backward compat) ──
export const postMedia = mysqlTable("post_media", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  /** Media type: video, audio, document */
  type: mysqlEnum("type", ["video", "audio", "document"]).notNull(),
  /** URL to the media file (S3) */
  url: text("url").notNull(),
  /** Canonical private postPhoto reference for newly uploaded video only. */
  posterUrl: text("posterUrl"),
  /** Original filename */
  filename: varchar("filename", { length: 512 }),
  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }),
  /** File size in bytes */
  fileSize: int("fileSize"),
  /** Duration in seconds (for video/audio) */
  duration: int("duration"),
  /** Display order within the post */
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("post_media_post_order").on(table.postId, table.sortOrder)]);

export type PostMedia = typeof postMedia.$inferSelect;
export type InsertPostMedia = typeof postMedia.$inferInsert;

// Recovery evidence survives detachment/deletion. Never auto-expire or rebind it.
export const privateAttachmentUploads = mysqlTable("private_attachment_uploads", {
  requestKey: varchar("requestKey", { length: 64 }).primaryKey(),
  actorUserId: int("actorUserId"),
  assetId: varchar("assetId", { length: 36 }).notNull(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  namespaceHash: varchar("namespaceHash", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["audio", "document", "video"]).notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  fileSize: int("fileSize").notNull(),
  state: mysqlEnum("state", ["pending", "ready"]).default("pending").notNull(),
  etag: varchar("etag", { length: 128 }),
  postId: int("postId"),
  mediaId: int("mediaId"),
  recoveryCompactedAt: timestamp("recoveryCompactedAt"),
  orphanedAt: timestamp("orphanedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("private_attachment_asset_unique").on(table.assetId),
  uniqueIndex("private_attachment_media_unique").on(table.mediaId),
  index("private_attachment_retention").on(table.createdAt, table.requestKey),
  index("private_attachment_owner_key").on(table.actorUserId, table.requestKey),
]);

// New content only. Parent identity survives detachment, preventing late replay/rebind.
export const privateContentFiles = mysqlTable("private_content_files", {
  requestKey: varchar("requestKey", { length: 64 }).primaryKey(),
  actorUserId: int("actorUserId"),
  assetId: varchar("assetId", { length: 36 }).notNull(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  namespaceHash: varchar("namespaceHash", { length: 64 }).notNull(),
  usage: mysqlEnum("usage", ["postPhoto", "articlePhoto", "articleDocument", "commentPhoto", "libraryPhoto", "libraryDocument"]).notNull(),
  targetPostId: int("targetPostId"),
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  fileSize: int("fileSize").notNull(),
  state: mysqlEnum("state", ["pending", "ready"]).default("pending").notNull(),
  etag: varchar("etag", { length: 128 }),
  parentKind: mysqlEnum("parentKind", ["post", "article", "comment", "library"]),
  parentId: int("parentId"),
  retiredAt: timestamp("retiredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("private_content_asset_unique").on(table.assetId),
  index("private_content_owner_key").on(table.actorUserId, table.requestKey),
  index("private_content_parent").on(table.parentKind, table.parentId),
]);

export const libraryFileBindings = mysqlTable("library_file_bindings", {
  id: int("id").autoincrement().primaryKey(),
  materialKey: varchar("materialKey", { length: 32 }).notNull(),
  fileKey: varchar("fileKey", { length: 64 }).notNull(),
  assetId: varchar("assetId", { length: 36 }).notNull(),
  sortOrder: int("sortOrder").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  revision: int("revision").notNull(),
}, table => [
  uniqueIndex("library_file_slot_unique").on(table.materialKey, table.fileKey),
  uniqueIndex("library_file_asset_unique").on(table.assetId),
]);

/** Operation journal stores opaque references, never source paths, URLs or file bytes. */
export const libraryFileMigrations = mysqlTable("library_file_migrations", {
  requestKey: varchar("requestKey", { length: 64 }).primaryKey(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  plan: json("plan").$type<string[]>().notNull(),
  state: mysqlEnum("state", ["pending", "committed", "rolledBack"]).default("pending").notNull(),
  previous: json("previous").$type<(typeof libraryFileBindings.$inferSelect | null)[]>(),
  result: json("result").$type<(typeof libraryFileBindings.$inferSelect)[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Feed: Tags (reference table for available tags) ──
export const commentCreationRequests = mysqlTable("comment_creation_requests", {
  requestKey: varchar("requestKey", { length: 64 }).primaryKey(),
  actorUserId: int("actorUserId"),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  claimToken: varchar("claimToken", { length: 36 }).notNull(),
  commentId: int("commentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("comment_creation_owner_key").on(table.actorUserId, table.requestKey)]);

export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique slug used in code (e.g. "spring", "home", "recipes") */
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  /** Human-readable label (e.g. "Весна", "Дом", "Рецепты") */
  label: varchar("label", { length: 128 }).notNull(),
  /** Category: season or topic */
  category: mysqlEnum("category", ["season", "topic"]).default("topic").notNull(),
  /** Display order in the tag bar */
  sortOrder: int("sortOrder").default(0).notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// ── Feed: Likes ──
export const likes = mysqlTable("likes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  postId: int("postId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("likes_post_lookup").on(table.postId),
  index("likes_user_post_lookup").on(table.userId, table.postId),
]);

export type Like = typeof likes.$inferSelect;
export type InsertLike = typeof likes.$inferInsert;

// ── Feed: Saved/Bookmarks ──
export const savedPosts = mysqlTable("saved_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  postId: int("postId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("saved_posts_user_created").on(table.userId, table.createdAt, table.id),
  index("saved_posts_user_post_created").on(table.userId, table.postId, table.createdAt, table.id),
]);

export type SavedPost = typeof savedPosts.$inferSelect;
export type InsertSavedPost = typeof savedPosts.$inferInsert;

// New public-purpose uploads only; receipt retention never authorizes object deletion.
export const publicPhotoUploads = mysqlTable("public_photo_uploads", {
  requestId: varchar("requestId", { length: 64 }).primaryKey(),
  actorUserId: int("actorUserId"),
  purpose: mysqlEnum("purpose", ["avatar", "publicCover"]).notNull(),
  assetId: varchar("assetId", { length: 36 }).notNull(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  outputHash: varchar("outputHash", { length: 64 }).notNull(),
  namespaceHash: varchar("namespaceHash", { length: 64 }).notNull(),
  fileSize: int("fileSize").notNull(),
  expectedAvatarUrl: text("expectedAvatarUrl"),
  state: mysqlEnum("state", ["pending", "ready"]).default("pending").notNull(),
  url: text("url"),
  avatarApplied: boolean("avatarApplied").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("public_photo_asset").on(table.assetId), index("public_photo_owner").on(table.actorUserId)]);

// ── Push Notification Tokens ──
export const pushTokens = mysqlTable("push_tokens", {
  id: int("id").autoincrement().primaryKey(),
  /** Expo push token (e.g. ExponentPushToken[xxx]) */
  token: varchar("token", { length: 256 }).notNull().unique(),
  /** Optional user ID if authenticated */
  userId: int("userId"),
  /** Platform: ios, android, web */
  platform: varchar("platform", { length: 16 }),
  /** Whether notifications are enabled for this device */
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = typeof pushTokens.$inferInsert;

// ── Push consent audit log (service vs marketing) ──
export const pushConsentEvents = mysqlTable("push_consent_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  consentType: mysqlEnum("consentType", ["service", "marketing"]).notNull(),
  status: mysqlEnum("status", ["granted", "revoked"]).notNull(),
  consentVersion: varchar("consentVersion", { length: 32 }).notNull(),
  consentText: text("consentText"),
  platform: varchar("platform", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PushConsentEvent = typeof pushConsentEvents.$inferSelect;
export type InsertPushConsentEvent = typeof pushConsentEvents.$inferInsert;

// ── Videos (YouTube imports) ──
export const videos = mysqlTable("videos", {
  id: int("id").autoincrement().primaryKey(),
  /** YouTube video ID (e.g. sq7pY1H_fYU) */
  youtubeId: varchar("youtubeId", { length: 32 }).unique(),
  provider: mysqlEnum("provider", ["youtube", "vk"]).default("youtube").notNull(),
  access: mysqlEnum("access", ["public", "club"]).default("public").notNull(),
  vkEmbedUrl: text("vkEmbedUrl"),
  vkSourceKey: varchar("vkSourceKey", { length: 64 }).unique("videos_vk_source_unique"),
  /** Video title */
  title: varchar("title", { length: 512 }).notNull(),
  /** Duration string (e.g. "15:27") */
  duration: varchar("duration", { length: 16 }),
  /** Thumbnail URL (S3 or YouTube) */
  thumbnailUrl: text("thumbnailUrl"),
  /** Video file URL on S3 (null if not yet uploaded) */
  videoUrl: text("videoUrl"),
  /** View count from YouTube (for display) */
  views: varchar("views", { length: 32 }),
  /** Published date text (e.g. "2 months ago") */
  publishedText: varchar("publishedText", { length: 64 }),
  /** Display order (lower = shown first) */
  sortOrder: int("sortOrder").default(0).notNull(),
  /** Whether the video is visible in the app */
  published: boolean("published").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

// ── Club: Pen pals ("Почтовое отделение") ──
export const penPalProfiles = mysqlTable("pen_pal_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  fullName: varchar("fullName", { length: 128 }),
  city: varchar("city", { length: 128 }).notNull(),
  interests: json("interests").$type<string[]>().notNull(),
  address: text("address").notNull(),
  adultConsentAt: timestamp("adultConsentAt"),
  consentVersion: varchar("consentVersion", { length: 32 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PenPalProfile = typeof penPalProfiles.$inferSelect;
export type InsertPenPalProfile = typeof penPalProfiles.$inferInsert;

export const penPalShown = mysqlTable("pen_pal_shown", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  matchUserId: int("matchUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  unique("pen_pal_shown_pair").on(table.userId, table.matchUserId),
]);

export type PenPalShown = typeof penPalShown.$inferSelect;
export type InsertPenPalShown = typeof penPalShown.$inferInsert;

export const penPalMatches = mysqlTable("pen_pal_matches", {
  id: int("id").autoincrement().primaryKey(),
  userLowId: int("userLowId").notNull(),
  userHighId: int("userHighId").notNull(),
  initiatedBy: int("initiatedBy").notNull(),
  userLowConfirmed: boolean("userLowConfirmed").default(false).notNull(),
  userHighConfirmed: boolean("userHighConfirmed").default(false).notNull(),
  mutualConfirmedAt: timestamp("mutualConfirmedAt"),
  confirmDeadline: timestamp("confirmDeadline").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  unique("pen_pal_matches_pair").on(table.userLowId, table.userHighId),
]);

export type PenPalMatch = typeof penPalMatches.$inferSelect;
export type InsertPenPalMatch = typeof penPalMatches.$inferInsert;

export const clubPayments = mysqlTable("club_payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  orderId: varchar("orderId", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  sum: varchar("sum", { length: 32 }),
  status: mysqlEnum("status", ["pending", "paid", "failed"]).default("pending").notNull(),
  paidAt: timestamp("paidAt"),
  expiresAt: timestamp("expiresAt"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClubPayment = typeof clubPayments.$inferSelect;
export type InsertClubPayment = typeof clubPayments.$inferInsert;

export const billingCheckoutIntents = mysqlTable("billing_checkout_intents", {
  intentKeyHash: varchar("intentKeyHash", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  shopId: varchar("shopId", { length: 20 }).notNull(),
  plan: mysqlEnum("plan", ["monthly", "semiannual"]).notNull(),
  requestHash: varchar("requestHash", { length: 64 }).notNull(),
  orderId: varchar("orderId", { length: 64 }).notNull().unique("billing_checkout_order"),
  requestBody: json("requestBody").$type<Record<string, unknown>>().notNull(),
  amountMinor: int("amountMinor").notNull(),
  accessDays: int("accessDays").notNull(),
  firstSentAt: timestamp("firstSentAt"),
  providerPaymentId: varchar("providerPaymentId", { length: 36 }),
  state: mysqlEnum("state", ["creating", "unknown", "ready", "succeeded", "canceled"]).notNull(),
  leaseId: varchar("leaseId", { length: 36 }),
  leaseUntil: timestamp("leaseUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  unique("billing_checkout_provider").on(table.shopId, table.providerPaymentId),
  index("billing_checkout_user").on(table.userId),
]);

export type BillingCheckoutIntent = typeof billingCheckoutIntents.$inferSelect;

export const normalCheckoutRequests = mysqlTable("normal_checkout_requests", {
  requestKey: varchar("requestKey", { length: 64 }).primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  requestHash: varchar("requestHash", { length: 64 }).notNull(),
  orderId: varchar("orderId", { length: 64 }).notNull().unique("normal_checkout_order_unique"),
  amountMinor: int("amountMinor").notNull(),
  merchantDomain: varchar("merchantDomain", { length: 255 }).notNull(),
  checkoutUrlHash: varchar("checkoutUrlHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const billingReceipts = mysqlTable("billing_receipts", {
  paymentKey: varchar("paymentKey", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  orderId: varchar("orderId", { length: 64 }).notNull(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  amountMinor: int("amountMinor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const billingProfiles = mysqlTable("billing_profiles", {
  profileKey: varchar("profileKey", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  subscriptionId: varchar("subscriptionId", { length: 64 }).notNull(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  amountMinor: int("amountMinor").notNull(),
  cancelRequestedAt: timestamp("cancelRequestedAt"),
  cancelledAt: timestamp("cancelledAt"),
  attempts: int("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt").defaultNow().notNull(),
  leaseId: varchar("leaseId", { length: 36 }),
  leaseUntil: timestamp("leaseUntil"),
}, (table) => [index("billing_profiles_user").on(table.userId)]);

export const passwordTokens = mysqlTable("password_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  purpose: mysqlEnum("purpose", ["setup", "reset"]).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("password_tokens_user").on(table.userId)]);

// First email binding has a separate proof namespace and cannot reset credentials.
export const memberEmailBindings = mysqlTable("member_email_bindings", {
  requestKey: varchar("requestKey", { length: 36 }).primaryKey(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  actorUserId: int("actorUserId").notNull(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }),
  proofHash: varchar("proofHash", { length: 64 }).unique(),
  state: mysqlEnum("state", ["pending", "confirmed", "expired", "cancelled"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("member_email_bindings_user_state").on(table.userId, table.state),
  index("member_email_bindings_retention").on(table.state, table.expiresAt, table.completedAt),
]);

// Dedicated outbox: its recipient must be checked against the pending binding,
// not the user's still-absent email. Existing password-mail checks stay intact.
export const memberEmailBindingOutbox = mysqlTable("member_email_binding_outbox", {
  requestKey: varchar("requestKey", { length: 36 }).primaryKey(),
  tokenCipher: text("tokenCipher"),
  sentAt: timestamp("sentAt"),
  discardedAt: timestamp("discardedAt"),
  lastError: varchar("lastError", { length: 64 }),
  nextAttemptAt: timestamp("nextAttemptAt").defaultNow().notNull(),
  attempts: int("attempts").default(0).notNull(),
  leaseId: varchar("leaseId", { length: 36 }),
  leaseUntil: timestamp("leaseUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("member_email_binding_outbox_due").on(table.sentAt, table.nextAttemptAt)]);

export const accessEmailOutbox = mysqlTable("access_email_outbox", {
  id: int("id").autoincrement().primaryKey(),
  eventKey: varchar("eventKey", { length: 128 }).notNull().unique(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  kind: mysqlEnum("kind", ["club-access", "password-setup", "password-reset"]).notNull(),
  payload: json("payload").$type<{ orderId?: string; tokenCipher?: string }>().notNull(),
  sentAt: timestamp("sentAt"),
  discardedAt: timestamp("discardedAt"),
  lastError: varchar("lastError", { length: 64 }),
  nextAttemptAt: timestamp("nextAttemptAt").defaultNow().notNull(),
  attempts: int("attempts").default(0).notNull(),
  leaseId: varchar("leaseId", { length: 36 }),
  leaseUntil: timestamp("leaseUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("access_email_outbox_due").on(table.sentAt, table.nextAttemptAt),
  index("access_email_outbox_user").on(table.userId),
]);

export const shopPurchases = mysqlTable("shop_purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  productId: varchar("productId", { length: 64 }).notNull(),
  orderId: varchar("orderId", { length: 80 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  sum: varchar("sum", { length: 32 }),
  status: mysqlEnum("status", ["pending", "paid", "failed"]).default("pending").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShopPurchase = typeof shopPurchases.$inferSelect;
export type InsertShopPurchase = typeof shopPurchases.$inferInsert;

export const postComments = mysqlTable("post_comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  parentId: int("parentId"),
  userId: int("userId").notNull(),
  text: text("text").notNull(),
  photos: json("photos").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("post_comments_post_created").on(table.postId, table.createdAt),
]);

export type PostComment = typeof postComments.$inferSelect;
export type InsertPostComment = typeof postComments.$inferInsert;

export const commentLikes = mysqlTable("comment_likes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  commentId: int("commentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  unique("comment_likes_unique").on(table.userId, table.commentId),
]);

export type CommentLike = typeof commentLikes.$inferSelect;
export type InsertCommentLike = typeof commentLikes.$inferInsert;

export const commentReports = mysqlTable("comment_reports", {
  id: int("id").autoincrement().primaryKey(),
  commentId: int("commentId").notNull(),
  reporterUserId: int("reporterUserId").notNull(),
  reason: varchar("reason", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  unique("comment_reports_unique").on(table.commentId, table.reporterUserId),
]);

export type CommentReport = typeof commentReports.$inferSelect;

export const userConsentEvents = mysqlTable("user_consent_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  consentKey: varchar("consentKey", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["granted", "revoked"]).notNull(),
  consentVersion: varchar("consentVersion", { length: 32 }).notNull(),
  consentText: text("consentText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserConsentEvent = typeof userConsentEvents.$inferSelect;

export const adminAuditLog = mysqlTable("admin_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("targetType", { length: 32 }).notNull(),
  targetId: int("targetId"),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;

export const shopDeliveryEmails = mysqlTable("shop_delivery_emails", {
  id: int("id").autoincrement().primaryKey(),
  orderId: varchar("orderId", { length: 128 }).notNull().unique(),
  userId: int("userId"),
  email: varchar("email", { length: 320 }).notNull(),
  productId: varchar("productId", { length: 64 }).notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShopDeliveryEmail = typeof shopDeliveryEmails.$inferSelect;

export type ArticleBlockType = "heading" | "text" | "photo" | "png" | "link" | "carousel";

export interface ArticleBlock {
  type: ArticleBlockType;
  text?: string;
  url?: string;
  label?: string;
  urls?: string[];
}

export type ArticleSection = ArticleBlock;

export const articles = mysqlTable("articles", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  coverUrl: text("coverUrl"),
  access: mysqlEnum("access", ["public", "club"]).default("public").notNull(),
  published: boolean("published").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  sections: json("sections").$type<ArticleBlock[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

export const smsCodes = mysqlTable("sms_codes", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 16 }).notNull(),
  codeHash: varchar("codeHash", { length: 64 }).notNull(),
  ip: varchar("ip", { length: 45 }).default("").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
});

export type SmsCode = typeof smsCodes.$inferSelect;
export type InsertSmsCode = typeof smsCodes.$inferInsert;
