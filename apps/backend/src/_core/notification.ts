/** Доставляет служебное уведомление владельцу через существующий интеграционный канал. */
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

/** Удаляет только внешние пробелы поля уведомления перед проверкой длины и отправкой. */
const trimValue = (value: string): string => value.trim();
/** Отсекает нестроковые и пробельные значения до trim и сетевой работы. */
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** Разрешает фиксированный RPC-путь относительно настроенной базы сервиса, корректно сохраняя её каталог. */
const buildEndpointUrl = (baseUrl: string): string => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase,
  ).toString();
};

/** Проверяет непустые заголовок/текст и лимиты длины; возвращает нормализованный payload либо BAD_REQUEST. */
const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/** Отправляет уведомление владельцу через Manus Notification Service.
 * true означает принятие запроса сервисом, false — отказ внешней доставки.
 * Ошибки входных данных остаются tRPC-ошибками для исправления вызывающим кодом.
 */
export async function notifyOwner(
  payload: NotificationPayload,
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured.",
    });
  }

  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured.",
    });
  }

  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 10_000);
  deadline.unref();
  let response: Response | undefined;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      // Тела и ошибки провайдера могут содержать доступы и данные получателя.
      console.warn(`[Notification] Provider rejected: HTTP ${response.status}`);
      return false;
    }

    return true;
  } catch {
    console.warn("[Notification] Provider request failed");
    return false;
  } finally {
    clearTimeout(deadline);
    await response?.body?.cancel().catch(() => {});
  }
}
