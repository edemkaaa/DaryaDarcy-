/** Проверяем полный публичный набор tRPC namespace/procedure, чтобы реорганизация модулей не удаляла API. */
import { describe, expect, it } from "vitest";
import { appRouter } from "../../apps/backend/src/routers";

const expectedProcedures = {
  admin: [
    "actionStatus",
    "articleCreationStatus",
    "articleDetail",
    "articles",
    "articlesPage",
    "cleanupMediaNames",
    "confirmPost",
    "createArticle",
    "createPost",
    "deleteArticle",
    "deleteMedia",
    "deletePost",
    "getPostMedia",
    "grantClub",
    "importVideoUrl",
    "importVideos",
    "members",
    "membersPage",
    "payments",
    "paymentsPage",
    "postCalendar",
    "postCounts",
    "postDetail",
    "posts",
    "postsFiltered",
    "postsPage",
    "privateAttachmentStatus",
    "privateContentFileStatus",
    "publicCoverUploadStatus",
    "purgeUserPushData",
    "scheduledPosts",
    "stats",
    "updateArticle",
    "updatePost",
    "uploadMedia",
    "uploadPhoto",
    "uploadPrivateAttachment",
    "uploadPrivateContentFile",
    "uploadPublicCover",
    "upsertVkVideo",
    "vkVideoDetail",
  ],
  articles: ["getById", "list"],
  auth: ["logout", "me"],
  club: [
    "addComment",
    "cancel",
    "claimPending",
    "comments",
    "commentsPage",
    "createCheckout",
    "createGuestNormalCheckout",
    "createNormalCheckout",
    "deleteComment",
    "guestNormalCheckoutStatus",
    "list",
    "listByCategory",
    "normalCheckoutStatus",
    "privateCommentPhotoStatus",
    "reconcileCheckout",
    "reportComment",
    "subscription",
    "toggleCommentLike",
    "updateComment",
    "uploadCommentPhoto",
    "uploadPrivateCommentPhoto",
  ],
  feed: [
    "getById",
    "interactionsForPosts",
    "list",
    "listPaginated",
    "savedPosts",
    "savedPostsPage",
    "tags",
    "toggleLike",
    "toggleSave",
    "userInteractions",
  ],
  moderation: [
    "blockUser",
    "deleteReportedComment",
    "dismissCommentReport",
    "listCommentReports",
    "unblockUser",
  ],
  notifications: [
    "latest",
    "marketingConsent",
    "registerToken",
    "setMarketingConsent",
  ],
  penPals: [
    "consentLabel",
    "find",
    "me",
    "remove",
    "requestMatch",
    "respondMatch",
    "upsert",
  ],
  profile: ["avatarUploadStatus", "update", "uploadAvatar", "uploadAvatarWithReceipt"],
  profileExtras: ["recoveryExport", "requestAccountDeletion"],
  shop: ["createCheckout", "owned"],
  system: ["health", "notifyOwner"],
  videos: ["catalog", "getById", "list", "playback", "publicYoutubeState"],
} as const;

/** Сортировка делает сравнение независимым от порядка регистрации роутеров. */
describe("public tRPC contract", () => {
  /** Сверяем реальные записи appRouter с явным перечнем; SQL, доступ и формы payload этим тестом не принимаются. */
  it("keeps every public namespace and procedure available", () => {
    const actualRecord = appRouter._def.record as Record<
      string,
      Record<string, unknown>
    >;
    const actualProcedures = Object.fromEntries(
      Object.entries(actualRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([namespace, procedures]) => [
          namespace,
          Object.keys(procedures).sort(),
        ]),
    );

    expect(actualProcedures).toEqual(expectedProcedures);
  });
});
