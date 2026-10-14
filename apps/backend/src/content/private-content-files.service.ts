import { Injectable, Inject } from "@nestjs/common";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { privateContentFiles, posts } from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import { SessionService } from "../identity/session.service";
import { userHasClubAccess } from "../identity/club-access";
import { HttpError } from "../../../../packages/shared/src/_core/errors";
import { privateStorageNamespace, privateAttachmentObjectKey } from "../media/private-upload-object";
import { contentFileUrl } from "./private-content-uploads";

@Injectable()
export class PrivateContentFilesService {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
  async authorizedFile(assetId: string, req: Request) {
    const database = await getDb(); if (!database) throw new Error("Database unavailable");
    const [file] = await database.select().from(privateContentFiles).where(eq(privateContentFiles.assetId, assetId)).limit(1);
    if (!file || file.state !== "ready" || !file.etag || file.retiredAt || file.parentId === null || file.namespaceHash !== privateStorageNamespace().hash) return;
    const url = contentFileUrl(assetId);
    let club = false;
    if (file.parentKind === "post" && file.usage === "postPhoto") {
      const [post] = await database.select().from(posts).where(eq(posts.id, file.parentId)).limit(1);
      if (!post?.published || post.status !== "published" || !post.photos?.includes(url)) return;
      if (!["feed", "both", "club"].includes(post.target)) return;
      club = post.target === "club";
    } else return;
    if (club) {
      if (!req.headers.cookie && !req.headers.authorization) return;
      try { if (!(await userHasClubAccess(await this.sessions.authenticateRequest(req)))) return; }
      catch (error) { if (error instanceof HttpError && error.statusCode === 403) return; throw error; }
    }
    return { key: privateAttachmentObjectKey("document", assetId, "content"), mime: file.mimeType, etag: file.etag, inline: file.mimeType === "image/webp" };
  }
}
