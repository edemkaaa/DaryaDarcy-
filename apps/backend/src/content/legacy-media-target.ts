import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  articles,
  posts,
  postMedia,
} from "../../../../packages/database/src/schema";
import type { LegacyMediaPlan } from "./legacy-media-manifest";
import type { PrivateAttachmentTransaction as Tx } from "./private-attachment-uploads";
import {
  articleFileReferences,
  postFileReferences,
  type ContentFileReference,
} from "./private-content-binding";

export const legacyConflict = () =>
  new TRPCError({
    code: "CONFLICT",
    message: "Ссылка или права изменились; перенос остановлен",
  });
export type LegacyTarget = {
  parentKind: "post" | "article";
  parentId: number;
  currentUrl: string;
  mediaId?: number;
  usage?: "postPhoto" | "articlePhoto" | "articleDocument";
  previous: ContentFileReference[];
  referencesAfter(url: string): Promise<ContentFileReference[]>;
  write(url: string): Promise<void>;
};

/** Actor is locked first. Parent then child locks match the existing editor order. */
export async function lockLegacyTarget(
  tx: Tx,
  plan: LegacyMediaPlan,
): Promise<LegacyTarget> {
  const { subject } = plan;
  if (subject.kind === "articleMedia") {
    const [article] = await tx
      .select()
      .from(articles)
      .where(eq(articles.id, subject.id))
      .for("update");
    if (!article?.published || article.access !== "club")
      throw legacyConflict();
    const match = /^sections\.(\d+)\.(url|urls\.(\d+))$/.exec(subject.slot)!;
    const index = Number(match[1]) - 1,
      nested = match[3] === undefined ? undefined : Number(match[3]);
    const block = article.sections[index];
    if (
      !block ||
      (nested !== undefined
        ? block.type !== "carousel" || plan.type !== "photo"
        : plan.type === "photo"
          ? !["photo", "png"].includes(block.type)
          : block.type !== "link" || plan.type !== "document")
    )
      throw legacyConflict();
    const currentUrl = nested === undefined ? block.url : block.urls?.[nested];
    if (typeof currentUrl !== "string") throw legacyConflict();
    const sections = (url: string) =>
      article.sections.map((entry, i) =>
        i !== index
          ? entry
          : nested === undefined
            ? { ...entry, url }
            : {
                ...entry,
                urls: entry.urls!.map((old, j) => (j === nested ? url : old)),
              },
      );
    return {
      parentKind: "article",
      parentId: article.id,
      currentUrl,
      usage: plan.type === "photo" ? "articlePhoto" : "articleDocument",
      previous: articleFileReferences(article.sections),
      referencesAfter: async (url) => articleFileReferences(sections(url)),
      write: async (url) => {
        await tx
          .update(articles)
          .set({ sections: sections(url), updatedAt: article.updatedAt })
          .where(eq(articles.id, article.id));
      },
    };
  }
  let postId = subject.id;
  if (subject.kind === "postMedia") {
    const [reference] = await tx
      .select({ postId: postMedia.postId })
      .from(postMedia)
      .where(eq(postMedia.id, subject.id));
    if (!reference) throw legacyConflict();
    postId = reference.postId;
  }
  const [post] = await tx
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .for("update");
  if (!post?.published || post.status !== "published" || post.target !== "club")
    throw legacyConflict();
  if (subject.kind === "postMedia") {
    const [media] = await tx
      .select()
      .from(postMedia)
      .where(eq(postMedia.id, subject.id))
      .for("update");
    if (!media || media.postId !== post.id || media.type !== plan.type)
      throw legacyConflict();
    return {
      parentKind: "post",
      parentId: post.id,
      mediaId: media.id,
      currentUrl: media.url,
      previous: [],
      referencesAfter: async () => [],
      write: async (url) => {
        await tx
          .update(postMedia)
          .set({ url })
          .where(eq(postMedia.id, media.id));
      },
    };
  }
  const index = Number(subject.slot.slice("photos.".length));
  const currentUrl = post.photos?.[index];
  if (typeof currentUrl !== "string") throw legacyConflict();
  const photos = (url: string) =>
    post.photos.map((old, i) => (i === index ? url : old));
  return {
    parentKind: "post",
    parentId: post.id,
    currentUrl,
    usage: "postPhoto",
    previous: await postFileReferences(tx, post.id, post.photos),
    referencesAfter: (url) => postFileReferences(tx, post.id, photos(url)),
    write: async (url) => {
      await tx
        .update(posts)
        .set({ photos: photos(url), updatedAt: post.updatedAt })
        .where(eq(posts.id, post.id));
    },
  };
}
