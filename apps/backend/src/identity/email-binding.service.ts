/** Связывает публичные операции привязки с жизненным циклом и хранилищем, не смешивая транспорт и SQL. */
import { Injectable } from "@nestjs/common";
import { getDb } from "../db";
import {
  EmailBindingError,
  requestMemberEmailBinding,
  type EmailBindingActor,
  type EmailBindingRequest,
} from "./email-binding";
import { getMemberEmailBindingStatus } from "./email-binding-status";
import { confirmMemberEmailBinding } from "./email-binding-confirmation";

@Injectable()
export class EmailBindingService {
  /** Требуем доступное подключение перед доменной операцией и возвращаем нейтральный unavailable без деталей драйвера. */
  private async database() {
    const database = await getDb();
    if (!database) throw new EmailBindingError("unavailable");
    return database;
  }
  /** Передаём подтверждённого администратора и входное намерение в транзакционную постановку привязки. */
  async request(actor: EmailBindingActor, input: EmailBindingRequest) {
    return requestMemberEmailBinding(await this.database(), actor, input);
  }
  /** Читаем состояние исходного ключа через доменную проверку текущих прав администратора без повторной отправки. */
  async status(actor: EmailBindingActor, requestKey: string) {
    return getMemberEmailBindingStatus(
      await this.database(),
      actor,
      requestKey,
    );
  }
  /** Погашаем одноразовое доказательство через доменный контракт; успешная привязка не создаёт сессию. */
  async confirm(token: string) {
    return confirmMemberEmailBinding(await this.database(), token);
  }
}
