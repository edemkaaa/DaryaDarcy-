import { Injectable } from "@nestjs/common";
import { getDb } from "../db";
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

  async resend(actorId: number, userId: number) {
    return resendClubAccess(await this.database(), actorId, userId);
  }
}
