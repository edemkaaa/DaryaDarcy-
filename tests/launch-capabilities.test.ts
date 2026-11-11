/** Выключенные возможности проверяются через настоящий router/HTTP до synthetic DB/SMS/order/profile effects. */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import type { User } from "../packages/database/src/schema";

const effects = vi.hoisted(() => ({
  database: 0,
  sms: 0,
  orders: 0,
  profiles: 0,
}));
vi.mock("../apps/backend/src/database/connection", () => ({
  getDb: async () => { effects.database++; return null; },
}));
vi.mock("../apps/backend/src/db", () => ({
  isOwnerAccount: (user: User) => user.role === "admin",
  getDb: async () => {
    effects.database++;
    return null;
  },
  publishDueScheduledPosts: async () => {
    effects.database++;
    return [];
  },
  createShopPurchase: async () => {
    effects.orders++;
  },
  getPenPalProfile: async () => {
    effects.profiles++;
    return null;
  },
  getShopPurchaseByOrderId: async () => {
    effects.orders++;
    return null;
  },
  markShopPurchasePaid: async () => {
    effects.orders++;
  },
  getUserByPhone: async () => {
    effects.database++;
    return {
      id: 7,
      openId: "sms-test",
      role: "user",
      blockedAt: null,
      sessionVersion: 0,
    };
  },
  upsertUser: async () => {
    effects.database++;
  },
}));
vi.mock("../apps/backend/src/sms-auth", () => ({
  clientIp: () => "127.0.0.1",
  issueSmsCode: async () => {
    effects.sms++;
    return { retryAfterSec: 60 };
  },
  consumeSmsCode: async () => {
    effects.sms++;
  },
}));
import { appRouter } from "../apps/backend/src/routers";
import { fulfillPaidOrder } from "../apps/backend/src/prodamus";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { processPendingShopDeliveryEmails } from "../apps/backend/src/shop-delivery";

let application: INestApplication;
let base: string;
/** Поднимаем локальный Nest с перехваченными внешними границами. */
beforeAll(async () => {
  application = await createBackendApplication();
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
/** Закрываем app и env. */
afterAll(async () => {
  await application.close();
  vi.unstubAllEnvs();
});
/** Явно выключаем SMS/PenPals/private uploads и сбрасываем счётчики эффектов. */
beforeEach(() => {
  vi.stubEnv("ENABLE_SMS_LOGIN", "false");
  vi.stubEnv("ENABLE_PEN_PALS", "false");
  vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false");
  vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "false");
  vi.stubEnv("PRIVATE_POST_VIDEO_UPLOAD_ENABLED", "false");
  vi.stubEnv("JWT_SECRET", "local-capability-test-only-secret-32-chars");
  Object.assign(effects, { database: 0, sms: 0, orders: 0, profiles: 0 });
});
/** Synthetic member вызывает настоящий защищённый роутер без user-supplied identity. */
function caller() {
  return appRouter.createCaller({
    user: {
      id: 7,
      role: "user",
      email: "user@example.test",
      blockedAt: null,
    } as User,
    req: {},
    res: {},
  } as TrpcContext);
}
/** Feature gate обязателен серверу, а не только скрытой кнопке UI. */
describe("first-release disabled features cannot mutate through direct requests", () => {
  /** Только точное true включает flag; capabilities no-store и не объявляют отсутствующие функции. */
  it("reports server capabilities without caching stale feature switches", async () => {
    vi.stubEnv("ENABLE_SMS_LOGIN", "TRUE");
    vi.stubEnv("ENABLE_PEN_PALS", "1");
    const response = await fetch(`${base}/api/capabilities`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      smsLogin: false,
      penPals: false,
      shopOnlinePayment: false,
      webPush: false,
      privateContentUploads: false,
      privatePostMediaUploads: false,
      privatePostVideoUploads: false,
    });
  });
  /** Эффективный binary video зависит от двух согласованных upload flags, не одного video switch. */
  it.each([
    [false, false, false, false],
    [false, false, true, false],
    [false, true, false, false],
    [false, true, true, true],
    [true, false, false, false],
    [true, false, true, false],
    [true, true, false, false],
    [true, true, true, true],
  ])(
    "advertises content=%s/media=%s/video=%s with effective video=%s without touching storage",
    async (content, media, video, effectiveVideo) => {
      vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", String(content));
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", String(media));
      vi.stubEnv("PRIVATE_POST_VIDEO_UPLOAD_ENABLED", String(video));
      const response = await fetch(`${base}/api/capabilities`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({
        privateContentUploads: content,
        privatePostMediaUploads: media,
        privatePostVideoUploads: effectiveVideo,
      });
      expect(effects.database).toBe(0);
    },
  );
  /** Disabled SMS возвращает503 FEATURE_DISABLED до внешней работы. */
  it.each(["send", "verify"])(
    "rejects direct SMS %s without calling SMS or database",
    async (action) => {
      const response = await fetch(`${base}/api/auth/sms/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+79991234567", code: "123456" }),
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "FEATURE_DISABLED" });
      expect(effects.sms).toBe(0);
      expect(effects.database).toBe(0);
    },
  );
  /** Старый public payment route не создаёт заказ и не redirect при disabled shop-online. */
  it("blocks the public shop redirect before creating a pending order", async () => {
    const response = await fetch(`${base}/api/pay/digital-1`, {
      redirect: "manual",
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(effects.orders).toBe(0);
  });
  /** Сессия не обходит shop feature gate. */
  it("blocks authenticated shop checkout before creating a pending order", async () => {
    await expect(
      caller().shop.createCheckout({ productId: "digital-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(effects.orders).toBe(0);
  });
  /** Старое order prefix не включает отключённый shop settlement. */
  it("does not fulfill an old shop webhook while shop settlement is unsafe", async () => {
    expect(
      await fulfillPaidOrder("shop-digital-1-old", {
        email: "user@example.test",
        userId: 7,
        sum: "1000",
      }),
    ).toBeNull();
    expect(effects.orders).toBe(0);
  });
  /** Очередь старой online-покупки не отправляется из выключенного сценария. */
  it("does not deliver queued legacy shop emails while online shop is disabled", async () => {
    await processPendingShopDeliveryEmails();
    expect(effects.database).toBe(0);
  });
  /** Me/find/request/respond/upsert отвергаются до чтения приватных анкет. */
  it.each([
    () => caller().penPals.me(),
    () => caller().penPals.find(),
    () => caller().penPals.requestMatch({ targetUserId: 8 }),
    () => caller().penPals.respondMatch({ matchId: 1, accept: true }),
    () =>
      caller().penPals.upsert({
        fullName: "User test",
        interests: ["books", "cooking"],
        address: "private address",
        adultConsent: true,
      }),
  ])(
    "does not expose addresses or create matches when pen pals are off",
    async (call) => {
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(effects.profiles).toBe(0);
    },
  );
  /** Отзыв анкеты остаётся доступным по смыслу приватности; здесь ожидается ошибка только ненастроенной БД, не feature gate. */
  it("allows privacy withdrawal to reach persistence even while discovery is disabled", async () => {
    // Deliberately unavailable database: authorization must not reject this route.
    await expect(caller().penPals.remove()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database not available",
    });
    expect(effects.database).toBe(1);
  });
});
