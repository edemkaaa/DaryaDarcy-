import { Injectable } from "@nestjs/common";
import * as db from "../db";
import * as platformDb from "../platform-db";
import { uploadPhoto } from "../media/photos";
import type { ProfileUpdateInput } from "./profile-input";

/** Adapters authorize/validate; SQL and photo helpers retain their policies. */
@Injectable()
export class ProfileService {
  async update(
    userId: number,
    input: ProfileUpdateInput,
  ): Promise<{ success: boolean }> {
    await db.updateUserProfile(userId, input);
    return { success: true };
  }

  async uploadAvatar(userId: number, base64: string): Promise<{ url: string }> {
    const result = await uploadPhoto(base64, `avatars/${userId}`);
    await db.updateUserProfile(userId, { avatarUrl: result.url });
    return { url: result.url };
  }

  async requestAccountDeletion(userId: number): Promise<{ ok: true }> {
    await platformDb.requestAccountDeletion(userId);
    return { ok: true };
  }
}
