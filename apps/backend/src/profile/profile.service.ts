import type { User } from "../../../../packages/database/src/schema";
import { Injectable } from "@nestjs/common";
import * as db from "../db";
import * as platformDb from "../platform-db";
import { uploadPhoto } from "../media/photos";
import type { ProfileUpdateInput } from "./profile-input";
import {
  exportContentRecovery,
  recoveryExportInput,
  requireRecoveryExportEnabled,
} from "../content/recovery-export";
import type { ContentWriteActor } from "../content/content-write-actor";
import type { z } from "zod";
import { TRPCError } from "@trpc/server";
import { saveProfile } from "./profile-writes";

/** Adapters authorize/validate; SQL and photo helpers retain their policies. */
@Injectable()
export class ProfileService {
  async recoveryExport(
    actor: ContentWriteActor,
    input: z.output<typeof recoveryExportInput>,
  ) {
    requireRecoveryExportEnabled();
    try {
      const database = await db.getDb();
      if (!database) throw new Error("Database unavailable");
      return await exportContentRecovery(database, actor, input);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Экспорт временно недоступен",
      });
    }
  }
  async update(
    userId: number,
    input: ProfileUpdateInput,
    sessionVersion: number,
  ): Promise<{ success: true; profileRevision: number }> {
    try {
      const database = await db.getDb();
      if (!database) throw new Error("Database unavailable");
      const profileRevision = await saveProfile(
        database,
        userId,
        sessionVersion,
        input,
      );
      return { success: true, profileRevision };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message:
          "Сохранение профиля временно недоступно. Проверьте результат перед повтором.",
      });
    }
  }

  async uploadAvatar(
    actor: Pick<User, "id" | "sessionVersion" | "profileRevision">,
    base64: string,
    signal?: AbortSignal,
  ): Promise<{ url: string }> {
    // Avoid an external write when persistence is already known to be unavailable.
    // Client acquisition is not a connection probe or a guarantee of the write.
    const database = await db.getDb();
    if (!database) throw new Error("Database not available");
    const precondition = { expectedRevision: actor.profileRevision };
    const checkProfile = async () => {
      await saveProfile(database, actor.id, actor.sessionVersion, precondition);
    };
    await checkProfile();
    // Пока фото декодировалось, сессия или версия профиля могли измениться.
    const result = await uploadPhoto(
      base64,
      `avatars/${actor.id}`,
      signal,
      checkProfile,
    );
    signal?.throwIfAborted();
    await saveProfile(database, actor.id, actor.sessionVersion, {
      ...precondition, avatarUrl: result.url,
    });
    return { url: result.url };
  }

  async requestAccountDeletion(
    actor: Pick<User, "id" | "openId" | "sessionVersion">,
  ): Promise<{ ok: true }> {
    await platformDb.requestAccountDeletion(actor);
    return { ok: true };
  }
}
