import { describe, expect, it } from "vitest";
import { appRouter } from "../apps/backend/src/routers";

const expectedProcedures = {
  admin: [
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
    "purgeUserPushData",
    "scheduledPosts",
    "stats",
    "updateArticle",
    "updatePost",
    "uploadMedia",
    "uploadPhoto",
  ],
  articles: ["getById", "list"],
  auth: ["logout", "me"],
  club: [
    "addComment",
    "cancel",
    "claimPending",
    "comments",
    "createCheckout",
    "deleteComment",
    "list",
    "reportComment",
    "subscription",
    "toggleCommentLike",
    "updateComment",
    "uploadCommentPhoto",
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
  profileExtras: ["requestAccountDeletion"],
  shop: ["createCheckout", "owned"],
  system: ["health", "notifyOwner"],
  videos: ["getById", "list"],
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
