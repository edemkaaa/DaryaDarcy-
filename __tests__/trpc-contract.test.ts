import { describe, expect, it } from "vitest";
import { appRouter } from "../apps/backend/src/routers";

const expectedProcedures = {
  admin: [
    "articleCreationStatus",
    "articles",
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
    "payments",
    "posts",
    "postsFiltered",
    "privateAttachmentStatus",
    "privateContentFileStatus",
    "purgeUserPushData",
    "scheduledPosts",
    "stats",
    "updateArticle",
    "updatePost",
    "uploadMedia",
    "uploadPhoto",
    "uploadPrivateAttachment",
    "uploadPrivateContentFile",
    "upsertVkVideo",
  ],
  articles: ["getById", "list"],
  auth: ["logout", "me"],
  club: [
    "addComment",
    "cancel",
    "claimPending",
    "comments",
    "createCheckout",
    "createNormalCheckout",
    "deleteComment",
    "list",
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
    "list",
    "listPaginated",
    "savedPosts",
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
  profile: ["update", "uploadAvatar"],
  profileExtras: ["recoveryExport", "requestAccountDeletion"],
  shop: ["createCheckout", "owned"],
  system: ["health", "notifyOwner"],
  videos: ["catalog", "getById", "list", "playback"],
} as const;

describe("public tRPC contract", () => {
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
