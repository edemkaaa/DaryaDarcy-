import { Injectable } from "@nestjs/common";
import { getDb } from "../db";
import type { User } from "../../../../packages/database/src/schema";
import { executeAdminAction } from "../admin/actions";
import {
  completePassword,
  requestPasswordEmail,
  resendClubAccess,
} from "./access";

@Injectable()
export class PasswordService {
  private async database() {
    const database = await getDb();
    if (!database) throw new Error("Database unavailable");
    return database;
  }

  async request(email: string) {
    return requestPasswordEmail(await this.database(), email);
  }

  async complete(token: string, password: string) {
    return completePassword(await this.database(), token, password);
  }

  async resend(actor: User, userId: number, idempotencyKey?: string) {
    const database = await this.database();
    if (idempotencyKey === undefined) return resendClubAccess(database, actor.id, userId);
    const result = await executeAdminAction(database, actor, { idempotencyKey, userId, kind: "resendAccessEmail" });
    return result.state === "succeeded";
  }
}
