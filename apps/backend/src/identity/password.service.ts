/** Сервис восстановления пароля поверх существующих одноразовых токенов и outbox. */
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
  /** Получаем подключение для одноразовых доказательств и outbox; отсутствие БД остаётся инфраструктурной ошибкой. */
  private async database() {
    const database = await getDb();
    if (!database) throw new Error("Database unavailable");
    return database;
  }

  /** Ставим письмо установки или восстановления через доменную нейтральную операцию, не отправляя SMTP в HTTP-запросе. */
  async request(email: string) {
    return requestPasswordEmail(await this.database(), email);
  }

  /** Погашаем доказательство и устанавливаем пароль через транзакционную проверку владельца и срока. */
  async complete(token: string, password: string) {
    return completePassword(await this.database(), token, password);
  }

  /** Для нового контракта используем журнал admin-action с исходным ключом, а старый вызов сохраняет совместимую постановку письма; успех означает queued, а не доставку. */
  async resend(actor: User, userId: number, idempotencyKey?: string) {
    const database = await this.database();
    if (idempotencyKey === undefined) return resendClubAccess(database, actor, userId);
    const result = await executeAdminAction(database, actor, { idempotencyKey, userId, kind: "resendAccessEmail" });
    return result.state === "succeeded";
  }
}
