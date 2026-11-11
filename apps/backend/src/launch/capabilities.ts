/** Серверные возможности выпуска ограничивают API независимо от видимости кнопок клиента. */
import type { Express } from "express";
import { TRPCError } from "@trpc/server";
import type { LaunchCapabilities } from "../../../../packages/shared/src/capabilities";

/** Политика включения функций принадлежит серверу, а не флагам видимости клиента. */
export function getCapabilities(): LaunchCapabilities {
  return {
    smsLogin: process.env.ENABLE_SMS_LOGIN === "true",
    penPals: process.env.ENABLE_PEN_PALS === "true",
    // Включение недоступно до отдельного проверенного атомарного settlement/outbox магазина.
    shopOnlinePayment: false,
    webPush: false,
    privateContentUploads: process.env.PRIVATE_CONTENT_FILES_ENABLED === "true",
    privatePostMediaUploads:
      process.env.PRIVATE_POST_MEDIA_UPLOAD_ENABLED === "true",
    privatePostVideoUploads:
      process.env.PRIVATE_POST_MEDIA_UPLOAD_ENABLED === "true" &&
      process.env.PRIVATE_POST_VIDEO_UPLOAD_ENABLED === "true",
  } as const;
}

/** Отказываем на API-границе, если серверная возможность выключена, независимо от клиентской кнопки. */
export function requireCapability(
  name: keyof ReturnType<typeof getCapabilities>,
): void {
  if (!getCapabilities()[name]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Функция пока недоступна",
    });
  }
}

/** Публикуем актуальные флаги возможностей без кеширования через совместимый Express-маршрут. */
export function registerCapabilityRoutes(app: Express): void {
  app.get("/api/capabilities", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(getCapabilities());
  });
}
