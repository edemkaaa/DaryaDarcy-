/** Сопоставляем файл, его владельца и актуальный материал перед открытием защищённого объекта. */
import { Injectable, Inject } from "@nestjs/common";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { privateContentFiles, postMedia, posts, articles, postComments } from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import { SessionService } from "../identity/session.service";
import { userHasClubAccess } from "../identity/club-access";
import { HttpError } from "../../../../packages/shared/src/_core/errors";
import { privateStorageNamespace, privateAttachmentObjectKey } from "../media/private-upload-object";
import { contentFileUrl } from "./private-content-uploads";
import { articleFileReferences } from "./private-content-binding";
import { privateMediaUrl, privateReceiptForMedia } from "./private-attachment-association";
import { libraryFileActive } from "./library-files";

@Injectable()
export class PrivateContentFilesService {
  /** Получаем проверку текущей сессии для фото комментариев и клубных материалов. */
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
  /** Проверяем готовый неотозванный файл, фактическое присутствие ссылки в опубликованном родителе и текущий доступ; только затем разрешаем серверный ключ, MIME и ETag. */
  async authorizedFile(assetId: string, req: Request) {
    const database = await getDb(); if (!database) throw new Error("Database unavailable");
    const [file] = await database.select().from(privateContentFiles).where(eq(privateContentFiles.assetId, assetId)).limit(1);
    if (!file || file.state !== "ready" || !file.etag || file.retiredAt || file.parentId === null || file.namespaceHash !== privateStorageNamespace().hash) return;
    const url = contentFileUrl(assetId);
    let club = false;
    let login = false;
    if (file.parentKind === "post" && file.usage === "postPhoto") {
      const [post] = await database.select().from(posts).where(eq(posts.id, file.parentId)).limit(1);
      if (!post?.published || post.status !== "published") return;
      if (!post.photos?.includes(url)) {
        const [video] = await database.select().from(postMedia)
          .where(and(eq(postMedia.postId, post.id), eq(postMedia.type, "video"), eq(postMedia.posterUrl, url))).limit(1);
        if (!video || video.url !== privateMediaUrl(video.id) ||
            !await privateReceiptForMedia(database, video)) return;
      }
      if (!["feed", "both", "club"].includes(post.target)) return;
      club = post.target === "club";
    } else if (file.parentKind === "article" && ["articlePhoto", "articleDocument"].includes(file.usage)) {
      const [article] = await database.select().from(articles).where(eq(articles.id, file.parentId)).limit(1);
      if (!article?.published || !articleFileReferences(article.sections).some(ref => ref.url === url && ref.usage === file.usage)) return;
      if (!["public", "club"].includes(article.access)) return;
      club = article.access === "club";
    } else if (file.parentKind === "comment" && file.usage === "commentPhoto") {
      const [comment] = await database.select().from(postComments).where(eq(postComments.id, file.parentId)).limit(1);
      if (!comment || comment.postId !== file.targetPostId || !comment.photos?.includes(url)) return;
      const [post] = await database.select().from(posts).where(eq(posts.id, comment.postId)).limit(1);
      if (!post?.published || post.status !== "published" || !["feed", "both", "club"].includes(post.target)) return;
      club = post.target === "club"; login = true;
    } else if (file.parentKind === "library") {
      if (!await libraryFileActive(file)) return;
      club = true;
    } else return;
// Открытые фото постов и статей допускают гостя; фото комментариев требуют входа, а клубные материалы и Библиотека ещё и членства.
    if (club || login) {
      if (!req.headers.cookie && !req.headers.authorization) return;
      try { const user = await this.sessions.authenticateRequest(req); if (club && !(await userHasClubAccess(user))) return; }
      catch (error) { if (error instanceof HttpError && error.statusCode === 403) return; throw error; }
    }
    return { key: privateAttachmentObjectKey("document", assetId, "content"), mime: file.mimeType, etag: file.etag, inline: ["image/webp", "image/jpeg", "image/png", "image/gif"].includes(file.mimeType) || file.usage === "libraryPhoto" };
  }
}
