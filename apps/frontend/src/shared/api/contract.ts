// Generated from apps/backend/src/routers.ts. Run pnpm api:contract after API changes.
// Types only; frontend has no dependency on backend runtime or folder layout.
import type {
  BuiltRouter,
  QueryProcedure,
  MutationProcedure,
  DefaultErrorShape,
} from "@trpc/server/unstable-core-do-not-import";
export type RichTextBlock = {
  type: "paragraph" | "heading";
  children: RichTextInline[];
};
export type PostMedia = {
  type: "video" | "audio" | "document";
  duration: number | null;
  id: number;
  createdAt: Date;
  url: string;
  filename: string | null;
  mimeType: string | null;
  postId: number;
  sortOrder: number;
  fileSize: number | null;
};
export type Post = {
  id: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<string>;
  photos: Array<string>;
  source: string;
  instagramId: string | null;
  sortOrder: number;
  published: boolean;
  status: "published" | "draft" | "scheduled";
  target: "feed" | "club" | "both";
  scheduledAt: Date | null;
  publishedAt: Date | null;
  richText: Array<RichTextBlock> | null;
};
export type PublicVideo = Omit<
  {
    duration: string | null;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    sortOrder: number;
    published: boolean;
    access: "club" | "public";
    provider: "vk" | "youtube";
    youtubeId: string | null;
    videoUrl: string | null;
    vkEmbedUrl: string | null;
    vkSourceKey: string | null;
    thumbnailUrl: string | null;
    views: string | null;
    publishedText: string | null;
  },
  "access" | "provider" | "youtubeId" | "vkEmbedUrl" | "vkSourceKey"
> & { youtubeId: string };
export type PostStatistics = {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  feedPosts: number;
  clubPosts: number;
  bothPosts: number;
  totalLikes: number;
  totalSaves: number;
  postsThisMonth: number;
  postsLastMonth: number;
  topLikedPosts: { id: number; text: string; likeCount: number }[];
};
export type ArticleBlock = {
  type: ArticleBlockType;
  text?: string;
  url?: string;
  label?: string;
  urls?: string[];
};
export type PostCommentRow = {
  id: number;
  text: string;
  createdAt: Date;
  postId: number;
  photos: Array<string> | null;
  userId: number;
  parentId: number | null;
} & {
  authorName: string | null;
  authorAvatarUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
};
export type PenPalMatchCard = {
  userId: number;
  matchId: number | null;
  name: string | null;
  avatarUrl: string | null;
  fullName: string;
  interests: string[];
  sharedInterests: string[];
  address?: string;
  myConfirmed: boolean;
  theirConfirmed: boolean;
  mutualConfirmed: boolean;
  confirmDeadline: Date | null;
};
export type CommentReportInboxRow = {
  id: number;
  commentId: number;
  reason: string;
  createdAt: Date;
  commentText: string;
  commentPhotos: string[] | null;
  postId: number;
  authorUserId: number;
  authorName: string | null;
  reporterUserId: number;
  reporterName: string | null;
};
export type RichTextInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  link?: string;
};
export type ArticleBlockType =
  | "link"
  | "text"
  | "heading"
  | "photo"
  | "png"
  | "carousel";
export type AppRouter = BuiltRouter<
  {
    ctx: object;
    meta: object;
    errorShape: DefaultErrorShape;
    transformer: true;
  },
  {
    system: {
      health: QueryProcedure<{
        input: { timestamp: number };
        output: { ok: boolean };
        meta: unknown;
      }>;
      notifyOwner: MutationProcedure<{
        input: { title: string; content: string };
        output: { readonly success: boolean };
        meta: unknown;
      }>;
    };
    auth: {
      me: QueryProcedure<{
        input: void;
        output: {
          id: number;
          openId: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          sessionVersion: number;
          loginMethod: string | null;
          gender: "female" | "male" | null;
          avatarUrl: string | null;
          role: "user" | "moderator" | "admin";
          blockedAt: Date | null;
          blockedReason: string | null;
          accountDeletionRequestedAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
          lastSignedIn: Date;
        } | null;
        meta: unknown;
      }>;
      logout: MutationProcedure<{
        input: void;
        output: { readonly success: true };
        meta: unknown;
      }>;
    };
    profile: {
      update: MutationProcedure<{
        input: {
          name?: string | undefined;
          gender?: "female" | "male" | undefined;
          avatarUrl?: string | undefined;
        };
        output: { success: boolean };
        meta: unknown;
      }>;
      uploadAvatar: MutationProcedure<{
        input: {
          base64: string;
          filename: string;
          mimeType?: string | undefined;
        };
        output: { url: string };
        meta: unknown;
      }>;
    };
    feed: {
      list: QueryProcedure<{
        input: { tag?: string | undefined } | undefined;
        output: Array<
          {
            id: number;
            text: string;
            createdAt: Date;
            updatedAt: Date;
            tags: Array<string>;
            photos: Array<string>;
            source: string;
            instagramId: string | null;
            sortOrder: number;
            published: boolean;
            status: "published" | "draft" | "scheduled";
            target: "feed" | "club" | "both";
            scheduledAt: Date | null;
            publishedAt: Date | null;
            richText: Array<RichTextBlock> | null;
          } & { likeCount: number; media: PostMedia[] }
        >;
        meta: unknown;
      }>;
      listPaginated: QueryProcedure<{
        input: {
          tag?: string | undefined;
          search?: string | undefined;
          limit?: number | undefined;
          cursor?: number | null | undefined;
        };
        output: {
          posts: (Post & { likeCount: number; media: PostMedia[] })[];
          nextCursor: number | null;
        };
        meta: unknown;
      }>;
      getById: QueryProcedure<{
        input: { id: number };
        output:
          | ({
              id: number;
              text: string;
              createdAt: Date;
              updatedAt: Date;
              tags: Array<string>;
              photos: Array<string>;
              source: string;
              instagramId: string | null;
              sortOrder: number;
              published: boolean;
              status: "published" | "draft" | "scheduled";
              target: "feed" | "club" | "both";
              scheduledAt: Date | null;
              publishedAt: Date | null;
              richText: Array<RichTextBlock> | null;
            } & { likeCount: number })
          | undefined;
        meta: unknown;
      }>;
      tags: QueryProcedure<{
        input: void;
        output: Array<{
          id: number;
          sortOrder: number;
          slug: string;
          label: string;
          category: "season" | "topic";
        }>;
        meta: unknown;
      }>;
      toggleLike: MutationProcedure<{
        input: { postId: unknown };
        output: boolean;
        meta: unknown;
      }>;
      toggleSave: MutationProcedure<{
        input: { postId: unknown };
        output: boolean;
        meta: unknown;
      }>;
      userInteractions: QueryProcedure<{
        input: void;
        output: { likedIds: Array<number>; savedIds: Array<number> };
        meta: unknown;
      }>;
      savedPosts: QueryProcedure<{
        input: void;
        output: Array<
          {
            id: number;
            text: string;
            createdAt: Date;
            updatedAt: Date;
            tags: Array<string>;
            photos: Array<string>;
            source: string;
            instagramId: string | null;
            sortOrder: number;
            published: boolean;
            status: "published" | "draft" | "scheduled";
            target: "feed" | "club" | "both";
            scheduledAt: Date | null;
            publishedAt: Date | null;
            richText: Array<RichTextBlock> | null;
          } & { likeCount: number; media: PostMedia[] }
        >;
        meta: unknown;
      }>;
    };
    notifications: {
      registerToken: MutationProcedure<{
        input: { token: string; platform?: string | undefined };
        output: { success: boolean };
        meta: unknown;
      }>;
      marketingConsent: QueryProcedure<{
        input: void;
        output: { enabled: boolean; label: string; version: string };
        meta: unknown;
      }>;
      setMarketingConsent: MutationProcedure<{
        input: { enabled: boolean; platform?: string | undefined };
        output: { success: boolean; enabled: boolean };
        meta: unknown;
      }>;
      latest: QueryProcedure<{
        input: void;
        output: {
          feedId: number | null;
          feedText: string;
          clubId: number | null;
          clubText: string;
        };
        meta: unknown;
      }>;
    };
    videos: {
      catalog: QueryProcedure<{
        input:
          | { limit?: number | undefined; cursor?: number | undefined }
          | undefined;
        output: {
          items: Array<{
            id: number;
            title: string;
            duration: string | null;
            access: "club" | "public";
            canWatch: boolean;
          }>;
          nextCursor: number | null;
        };
        meta: unknown;
      }>;
      playback: QueryProcedure<{
        input: { id: number };
        output:
          | { id: number; provider: "vk"; embedUrl: string }
          | {
              id: number;
              provider: "youtube";
              youtubeId: string;
              videoUrl: string | null;
            };
        meta: unknown;
      }>;
      list: QueryProcedure<{
        input: void;
        output: Array<PublicVideo>;
        meta: unknown;
      }>;
      getById: QueryProcedure<{
        input: { id: number };
        output: PublicVideo | undefined;
        meta: unknown;
      }>;
    };
    admin: {
      posts: QueryProcedure<{
        input: void;
        output: Array<
          {
            id: number;
            text: string;
            createdAt: Date;
            updatedAt: Date;
            tags: Array<string>;
            photos: Array<string>;
            source: string;
            instagramId: string | null;
            sortOrder: number;
            published: boolean;
            status: "published" | "draft" | "scheduled";
            target: "feed" | "club" | "both";
            scheduledAt: Date | null;
            publishedAt: Date | null;
            richText: Array<RichTextBlock> | null;
          } & { media: PostMedia[] }
        >;
        meta: unknown;
      }>;
      createPost: MutationProcedure<{
        input: {
          text: string;
          photos: Array<string>;
          tags: Array<string>;
          idempotencyKey?: string | undefined;
          videos?: Array<string> | undefined;
          attachments?:
            | Array<{
                type: "audio" | "document";
                url: string;
                filename: string;
                mimeType: string;
                fileSize: number;
              }>
            | undefined;
          source?: string | undefined;
          published?: boolean | undefined;
          sortOrder?: number | undefined;
          status?: "published" | "draft" | "scheduled" | undefined;
          target?: "feed" | "club" | "both" | undefined;
          scheduledAt?: string | null | undefined;
          publishedAt?: string | null | undefined;
          richText?: any;
        };
        output: number;
        meta: unknown;
      }>;
      updatePost: MutationProcedure<{
        input: {
          id: number;
          text?: string | undefined;
          photos?: Array<string> | undefined;
          tags?: Array<string> | undefined;
          videos?: Array<string> | undefined;
          attachments?:
            | Array<{
                type: "audio" | "document";
                url: string;
                filename: string;
                mimeType: string;
                fileSize: number;
              }>
            | undefined;
          removedMediaIds?: Array<number> | undefined;
          published?: boolean | undefined;
          sortOrder?: number | undefined;
          status?: "published" | "draft" | "scheduled" | undefined;
          target?: "feed" | "club" | "both" | undefined;
          scheduledAt?: string | null | undefined;
          publishedAt?: string | null | undefined;
          richText?: any;
        };
        output: { success: boolean };
        meta: unknown;
      }>;
      deletePost: MutationProcedure<{
        input: { id: number };
        output: void;
        meta: unknown;
      }>;
      importVideoUrl: MutationProcedure<{
        input: { url: string };
        output: { url: string; fileSize?: number };
        meta: unknown;
      }>;
      uploadPhoto: MutationProcedure<{
        input: {
          base64: string;
          filename: string;
          mimeType?: string | undefined;
        };
        output: { url: string };
        meta: unknown;
      }>;
      uploadMedia: MutationProcedure<{
        input: {
          base64: string;
          filename: string;
          mimeType: string;
          type: "video" | "audio" | "document";
          postId?: number | undefined;
          duration?: number | undefined;
        };
        output: {
          url: string;
          mediaId: number | undefined;
          mimeType: string;
          fileSize: number;
        };
        meta: unknown;
      }>;
      getPostMedia: QueryProcedure<{
        input: { postId: number };
        output: Array<{
          type: "video" | "audio" | "document";
          duration: number | null;
          id: number;
          createdAt: Date;
          url: string;
          filename: string | null;
          mimeType: string | null;
          postId: number;
          sortOrder: number;
          fileSize: number | null;
        }>;
        meta: unknown;
      }>;
      deleteMedia: MutationProcedure<{
        input: { id: number };
        output: void;
        meta: unknown;
      }>;
      scheduledPosts: QueryProcedure<{
        input: void;
        output: Array<{
          id: number;
          text: string;
          createdAt: Date;
          updatedAt: Date;
          tags: Array<string>;
          photos: Array<string>;
          source: string;
          instagramId: string | null;
          sortOrder: number;
          published: boolean;
          status: "published" | "draft" | "scheduled";
          target: "feed" | "club" | "both";
          scheduledAt: Date | null;
          publishedAt: Date | null;
          richText: Array<RichTextBlock> | null;
        }>;
        meta: unknown;
      }>;
      stats: QueryProcedure<{
        input: void;
        output: PostStatistics;
        meta: unknown;
      }>;
      members: QueryProcedure<{
        input: void;
        output: Array<{
          id: number;
          email: string | null;
          name: string | null;
          role: string | null;
          createdAt: Date;
          clubExpiresAt: Date | null;
          blockedAt: Date | null;
          blockedReason: string | null;
        }>;
        meta: unknown;
      }>;
      payments: QueryProcedure<{
        input: void;
        output: Array<{
          id: number;
          userId: number;
          orderId: string;
          email: string | null;
          sum: string | null;
          status: "pending" | "paid" | "failed";
          paidAt: Date | null;
          expiresAt: Date | null;
          cancelAtPeriodEnd: boolean;
          cancelledAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }>;
        meta: unknown;
      }>;
      grantClub: MutationProcedure<{
        input: { userId: number };
        output: { ok: true; expiresAt: string };
        meta: unknown;
      }>;
      articles: QueryProcedure<{
        input: void;
        output: Array<{
          id: number;
          createdAt: Date;
          updatedAt: Date;
          title: string;
          sortOrder: number;
          published: boolean;
          access: "club" | "public";
          coverUrl: string | null;
          sections: Array<ArticleBlock>;
        }>;
        meta: unknown;
      }>;
      createArticle: MutationProcedure<{
        input: {
          title: string;
          sections: Array<{
            type: "link" | "text" | "heading" | "photo" | "png" | "carousel";
            text?: string | undefined;
            url?: string | undefined;
            label?: string | undefined;
            caption?: string | undefined;
            urls?: Array<string> | undefined;
          }>;
          idempotencyKey?: string | undefined;
          coverUrl?: string | null | undefined;
          access?: "club" | "public" | undefined;
          published?: boolean | undefined;
          sortOrder?: number | undefined;
        };
        output: number;
        meta: unknown;
      }>;
      articleCreationStatus: QueryProcedure<{
        input: { idempotencyKey: string };
        output:
          | { status: "notRecorded" }
          | { status: "created" | "deleted"; articleId: number };
        meta: unknown;
      }>;
      updateArticle: MutationProcedure<{
        input: {
          id: number;
          title?: string | undefined;
          coverUrl?: string | null | undefined;
          access?: "club" | "public" | undefined;
          published?: boolean | undefined;
          sortOrder?: number | undefined;
          sections?:
            | Array<{
                type:
                  | "link"
                  | "text"
                  | "heading"
                  | "photo"
                  | "png"
                  | "carousel";
                text?: string | undefined;
                url?: string | undefined;
                label?: string | undefined;
                caption?: string | undefined;
                urls?: Array<string> | undefined;
              }>
            | undefined;
        };
        output: { ok: true };
        meta: unknown;
      }>;
      deleteArticle: MutationProcedure<{
        input: { id: number };
        output: { ok: true };
        meta: unknown;
      }>;
      cleanupMediaNames: MutationProcedure<{
        input: void;
        output: { ok: true };
        meta: unknown;
      }>;
      confirmPost: MutationProcedure<{
        input: { id: number };
        output: { success: boolean };
        meta: unknown;
      }>;
      postsFiltered: QueryProcedure<{
        input:
          | {
              status?: "published" | "draft" | "scheduled" | undefined;
              target?: "feed" | "club" | "both" | undefined;
            }
          | undefined;
        output: Array<{
          id: number;
          text: string;
          createdAt: Date;
          updatedAt: Date;
          tags: Array<string>;
          photos: Array<string>;
          source: string;
          instagramId: string | null;
          sortOrder: number;
          published: boolean;
          status: "published" | "draft" | "scheduled";
          target: "feed" | "club" | "both";
          scheduledAt: Date | null;
          publishedAt: Date | null;
          richText: Array<RichTextBlock> | null;
        }>;
        meta: unknown;
      }>;
      importVideos: MutationProcedure<{
        input: {
          videos: Array<{
            youtubeId: string;
            title: string;
            duration?: string | undefined;
            thumbnailUrl?: string | undefined;
            views?: string | undefined;
            publishedText?: string | undefined;
            access?: undefined;
            provider?: undefined;
            vkEmbedUrl?: undefined;
            vkSourceKey?: undefined;
          }>;
        };
        output: { imported: number };
        meta: unknown;
      }>;
      upsertVkVideo: MutationProcedure<{
        input: {
          embedUrl: string;
          title: string;
          access: "club" | "public";
          published: boolean;
          id?: number | undefined;
        };
        output: { id: number };
        meta: unknown;
      }>;
      purgeUserPushData: MutationProcedure<{
        input: { userId: number };
        output: { success: boolean };
        meta: unknown;
      }>;
    };
    club: {
      normalCheckoutStatus: QueryProcedure<{
        input: { idempotencyKey: string };
        output:
          | { state: "notRecorded" }
          | { state: "pending"; orderId: string }
          | { state: "succeeded"; orderId: string; expiresAt: Date }
          | { state: "failed"; orderId: string };
        meta: unknown;
      }>;
      createNormalCheckout: MutationProcedure<{
        input: {
          idempotencyKey: string;
          plan?: "monthly" | "semiannual" | undefined;
        };
        output:
          | { state: "succeeded"; orderId: string; expiresAt: Date }
          | { state: "failed"; orderId: string }
          | { state: "pending"; orderId: string; url: string };
        meta: unknown;
      }>;
      list: QueryProcedure<{
        input:
          | {
              tag?: string | undefined;
              limit?: number | undefined;
              cursor?: number | null | undefined;
            }
          | undefined;
        output: {
          posts: (Post & { likeCount: number })[];
          nextCursor: number | null;
        };
        meta: unknown;
      }>;
      subscription: QueryProcedure<{
        input: void;
        output: {
          hasClubAccess: boolean;
          subscribed: boolean;
          expiresAt: Date | null;
          cancelAtPeriodEnd: boolean;
          isOwner: boolean;
          monthlyPrice: string;
        };
        meta: unknown;
      }>;
      reconcileCheckout: MutationProcedure<{
        input: undefined;
        output: { state: "unknown" | "pending" | "succeeded" | "canceled" };
        meta: unknown;
      }>;
      createCheckout: MutationProcedure<{
        input:
          | {
              email?: string | undefined;
              plan?: "monthly" | "semiannual" | undefined;
            }
          | undefined;
        output: { url: string; user: null };
        meta: unknown;
      }>;
      claimPending: MutationProcedure<{
        input: void;
        output:
          | { granted: true; orderId: string }
          | { granted: false; orderId: null };
        meta: unknown;
      }>;
      cancel: MutationProcedure<{
        input: void;
        output: { ok: true; expiresAt: Date | null };
        meta: unknown;
      }>;
      comments: QueryProcedure<{
        input: { postId: number };
        output: Array<PostCommentRow>;
        meta: unknown;
      }>;
      addComment: MutationProcedure<{
        input: {
          postId: number;
          text: string;
          parentId?: number | undefined;
          photos?: Array<string> | undefined;
        };
        output: { id: number };
        meta: unknown;
      }>;
      updateComment: MutationProcedure<{
        input: { id: number; text: string };
        output: { ok: true };
        meta: unknown;
      }>;
      toggleCommentLike: MutationProcedure<{
        input: { commentId: number };
        output: { liked: boolean; likeCount: number };
        meta: unknown;
      }>;
      deleteComment: MutationProcedure<{
        input: { id: number };
        output: { ok: true };
        meta: unknown;
      }>;
      reportComment: MutationProcedure<{
        input: { id: number; reason: string };
        output: { ok: true };
        meta: unknown;
      }>;
      uploadCommentPhoto: MutationProcedure<{
        input: {
          base64: string;
          filename: string;
          mimeType?: string | undefined;
        };
        output: { url: string };
        meta: unknown;
      }>;
    };
    penPals: {
      me: QueryProcedure<{
        input: void;
        output: {
          fullName: string;
          interests: Array<string>;
          address: string;
        } | null;
        meta: unknown;
      }>;
      upsert: MutationProcedure<{
        input: {
          fullName: string;
          interests: Array<string>;
          address: string;
          adultConsent: true;
        };
        output: { fullName: string; interests: Array<string>; address: string };
        meta: unknown;
      }>;
      find: MutationProcedure<{
        input: void;
        output:
          | { needsProfile: true; matches: PenPalMatchCard[] }
          | { needsProfile: false; matches: Array<PenPalMatchCard> };
        meta: unknown;
      }>;
      requestMatch: MutationProcedure<{
        input: { targetUserId: number };
        output: { matchId: number };
        meta: unknown;
      }>;
      respondMatch: MutationProcedure<{
        input: { matchId: number; accept: boolean };
        output: { ok: true };
        meta: unknown;
      }>;
      remove: MutationProcedure<{
        input: void;
        output: { success: true };
        meta: unknown;
      }>;
      consentLabel: QueryProcedure<{
        input: void;
        output: { label: string; version: string };
        meta: unknown;
      }>;
    };
    shop: {
      owned: QueryProcedure<{
        input: { productId: string };
        output: { owned: boolean };
        meta: unknown;
      }>;
      createCheckout: MutationProcedure<{
        input: { productId: string };
        output: { url: string };
        meta: unknown;
      }>;
    };
    moderation: {
      listCommentReports: QueryProcedure<{
        input: void;
        output: Array<CommentReportInboxRow>;
        meta: unknown;
      }>;
      dismissCommentReport: MutationProcedure<{
        input: { reportId: number };
        output: { ok: true };
        meta: unknown;
      }>;
      deleteReportedComment: MutationProcedure<{
        input: { commentId: number; reportId?: number | undefined };
        output: { ok: true };
        meta: unknown;
      }>;
      blockUser: MutationProcedure<{
        input: { userId: number; reason: string };
        output: { ok: true };
        meta: unknown;
      }>;
      unblockUser: MutationProcedure<{
        input: { userId: number };
        output: { ok: true };
        meta: unknown;
      }>;
    };
    profileExtras: {
      requestAccountDeletion: MutationProcedure<{
        input: void;
        output: { ok: true };
        meta: unknown;
      }>;
    };
    articles: {
      list: QueryProcedure<{
        input: void;
        output: Array<{
          id: number;
          title: string;
          coverUrl: string | null;
          access: "club" | "public";
        }>;
        meta: unknown;
      }>;
      getById: QueryProcedure<{
        input: { id: number };
        output:
          | {
              id: number;
              title: string;
              coverUrl: string | null;
              access: "club" | "public";
              locked: true;
              sections: Array<never>;
            }
          | {
              id: number;
              title: string;
              coverUrl: string | null;
              access: "club" | "public";
              locked: false;
              sections: Array<ArticleBlock>;
            }
          | undefined;
        meta: unknown;
      }>;
    };
  }
>;
