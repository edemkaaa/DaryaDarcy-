/** Регистрация токенов, согласия и очистка push-данных через общие SQL-операции. */
import { Injectable } from "@nestjs/common";
import * as db from "../db";
import {
  MARKETING_PUSH_CONSENT_LABEL,
  MARKETING_PUSH_CONSENT_VERSION,
} from "../../../../packages/shared/src/push-consent";
import type {
  RegisterTokenInput,
  SetMarketingConsentInput,
} from "./notification-input";
import { requireCapability } from "../launch/capabilities";

/** Адаптер проверяет вход и права; SQL и семантика upsert принадлежат существующим helpers. */
@Injectable()
export class NotificationsService {
  /** Флаг выпуска проверяется до записи; принадлежность токена фиксируют общие SQL-операции. */
  async registerToken(
    input: RegisterTokenInput,
    actor?: db.PushWriteActor,
  ): Promise<{ success: boolean }> {
    requireCapability("webPush");
    await db.registerPushToken(input.token, actor, input.platform);
    return { success: true };
  }

  /** Возвращаем актуальное согласие пользователя вместе с текущими текстом и версией, не считая наличие токена согласием. */
  async marketingConsent(
    userId: number,
  ): Promise<{ enabled: boolean; label: string; version: string }> {
    const enabled = await db.hasMarketingPushConsent(userId);
    return {
      enabled,
      label: MARKETING_PUSH_CONSENT_LABEL,
      version: MARKETING_PUSH_CONSENT_VERSION,
    };
  }

  /** Пишем явное предоставление или отзыв маркетингового согласия под текущей сессией исполнителя с точной версией и текстом. */
  async setMarketingConsent(
    actor: db.PushWriteActor,
    input: SetMarketingConsentInput,
  ): Promise<{ success: boolean; enabled: boolean }> {
    await db.logPushConsentEvent(
      actor,
      "marketing",
      input.enabled ? "granted" : "revoked",
      input.platform,
      MARKETING_PUSH_CONSENT_VERSION,
      MARKETING_PUSH_CONSENT_LABEL,
    );
    return { success: true, enabled: input.enabled };
  }

  /** Удаляем push-данные заданного пользователя через проверку текущего администратора внутри транзакции. */
  async purgeUserPushData(
    userId: number,
    actor: db.PushWriteActor,
  ): Promise<{ success: boolean }> {
    await db.deletePushTokensForUser(userId, actor);
    return { success: true };
  }
}
