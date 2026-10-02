import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, unique, index } from "drizzle-orm/mysql-core";
import type { RichTextBlock, RichTextInline } from "../../shared/src/rich-text-types";

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
});

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

// ── Post Media (video, audio, documents — photos stay in posts.photos for backward compat) ──
export const postMedia = mysqlTable("post_media", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  /** Media type: video, audio, document */
  type: mysqlEnum("type", ["video", "audio", "document"]).notNull(),
  /** URL to the media file (S3) */
  url: text("url").notNull(),
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
});

export type PostMedia = typeof postMedia.$inferSelect;
export type InsertPostMedia = typeof postMedia.$inferInsert;

// ── Feed: Tags (reference table for available tags) ──
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
});

export type Like = typeof likes.$inferSelect;
export type InsertLike = typeof likes.$inferInsert;

// ── Feed: Saved/Bookmarks ──
export const savedPosts = mysqlTable("saved_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  postId: int("postId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SavedPost = typeof savedPosts.$inferSelect;
export type InsertSavedPost = typeof savedPosts.$inferInsert;

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
  youtubeId: varchar("youtubeId", { length: 32 }).notNull().unique(),
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
}, (table) => [index("access_email_outbox_due").on(table.sentAt, table.nextAttemptAt)]);

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
});

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
