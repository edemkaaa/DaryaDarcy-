import { Injectable, Inject } from "@nestjs/common";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { postMedia, posts } from "../../../../packages/database/src/schema";
import { HttpError } from "../../../../packages/shared/src/_core/errors";
import { getDb } from "../db";
import { SessionService } from "../identity/session.service";
import { userHasClubAccess } from "../identity/club-access";
import { ownAttachmentKey } from "../media/private-object";

const SAFE_MIMES = new Set([
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/octet-stream",
]);

@Injectable()
export class PrivateFilesService {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async authorizedAttachment(id: number, req: Request) {
    const database = await getDb();
    if (!database) throw new Error("Database unavailable");
    const [row] = await database
      .select({
        url: postMedia.url,
        type: postMedia.type,
        mime: postMedia.mimeType,
        published: posts.published,
        status: posts.status,
        target: posts.target,
      })
      .from(postMedia)
      .innerJoin(posts, eq(posts.id, postMedia.postId))
      .where(eq(postMedia.id, id))
      .limit(1);
    if (!row?.published || row.status !== "published") return;
    if (row.target === "club") {
      if (!req.headers.cookie && !req.headers.authorization) return;
      let user;
      try {
        user = await this.sessions.authenticateRequest(req);
      } catch (error) {
        if (error instanceof HttpError && error.statusCode === 403) return;
        throw error;
      }
      if (!(await userHasClubAccess(user))) return;
    } else if (row.target !== "feed" && row.target !== "both") return;
    const key = ownAttachmentKey(row.url);
    const mime =
      row.mime?.split(";")[0].trim().toLowerCase() ??
      "application/octet-stream";
    if (!key || !SAFE_MIMES.has(mime)) return;
    return { key, mime };
  }
}
