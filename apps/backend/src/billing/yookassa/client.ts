/** Клиент только TEST-режима YooKassa: фиксированный origin, валидация ответов и ограниченные запросы. */
import { z } from "zod";
import { moneyMinor } from "../protocol";

export type YookassaTestConfig = {
  shopId: string;
  secretKey: string;
  returnUrl: string;
};
export const paymentIdSchema = z
  .string()
  .regex(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
const paymentSchema = z.object({
  id: paymentIdSchema,
  status: z.enum(["pending", "waiting_for_capture", "succeeded", "canceled"]),
  paid: z.boolean(),
  test: z.literal(true),
  amount: z.object({
    value: z.string().regex(/^\d{1,7}\.\d{2}$/),
    currency: z.literal("RUB"),
  }),
  recipient: z.object({ account_id: z.string() }),
  metadata: z.object({ order_id: z.string().max(64) }),
  confirmation: z
    .object({
      type: z.literal("redirect"),
      confirmation_url: z.string().max(2048),
    })
    .optional(),
  payment_method: z.object({ saved: z.literal(false) }).optional(),
});
export type YookassaPayment = z.infer<typeof paymentSchema>;
const orderIdSchema = z
  .string()
  .regex(/^yk-club-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
const requestSchema = z
  .object({
    amount: z
      .object({
        value: z.string().regex(/^\d{1,7}\.\d{2}$/),
        currency: z.literal("RUB"),
      })
      .strict(),
    capture: z.literal(true),
    save_payment_method: z.literal(false),
    description: z.literal("DaryaDarcy: test club access"),
    confirmation: z
      .object({ type: z.literal("redirect"), return_url: z.string().max(2048) })
      .strict(),
    metadata: z.object({ order_id: orderIdSchema }).strict(),
  })
  .strict();
export type YookassaCreateRequest = z.infer<typeof requestSchema>;
/** Создаёт обезличенную ошибку провайдера без тела ответа, секрета и реквизитов получателя. */
const failure = () => new Error("YooKassa provider unavailable");

/** Допускает только точный TEST-флаг, test_ ключ, shopId и фиксированный dev-origin; формирует отдельный returnUrl. */
export function readYookassaTestConfig(
  env: NodeJS.ProcessEnv = process.env,
): YookassaTestConfig {
  if (
    env.YOOKASSA_TEST_ENABLED !== "true" ||
    !/^\d{1,20}$/.test(env.YOOKASSA_SHOP_ID || "") ||
    !/^test_[A-Za-z0-9_-]{16,200}$/.test(env.YOOKASSA_SECRET_KEY || "") ||
    env.PUBLIC_APP_URL !== "https://daryadarcy.dev.reeskeen.ru"
  )
    throw failure();
  return {
    shopId: env.YOOKASSA_SHOP_ID!,
    secretKey: env.YOOKASSA_SECRET_KEY!,
    returnUrl: `${env.PUBLIC_APP_URL}/club`,
  };
}

/** Разрешает браузерный переход лишь на HTTPS yoomoney.ru в известных каталогах без credentials/port/fragment. */
export function confirmationUrl(payment: YookassaPayment): string | null {
  if (!payment.confirmation) return null;
  const url = new URL(payment.confirmation.confirmation_url);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "yoomoney.ru" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/(checkout|api-pages|payments)\//.test(url.pathname)
  )
    throw failure();
  return url.href;
}

/** Ограниченный транспорт с фиксированным origin; тела провайдера и доступы наружу не передаются. */
export class YookassaTestClient {
  private inFlight = 0;
  /** Сохраняет уже проверенную TEST-конфигурацию для ограниченного клиента фиксированного origin. */
  constructor(private readonly config: YookassaTestConfig) {}
  /** Строит строго разовый RUB capture из целых minor units и проверенного yk-club order, без сохранения платёжного метода. */
  paymentRequest(orderId: string, amountMinor: number): YookassaCreateRequest {
    if (
      !orderIdSchema.safeParse(orderId).success ||
      !Number.isSafeInteger(amountMinor) ||
      amountMinor <= 0 ||
      amountMinor > 999999999
    )
      throw failure();
    return {
      amount: {
        value: `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, "0")}`,
        currency: "RUB",
      },
      capture: true,
      save_payment_method: false,
      description: "DaryaDarcy: test club access",
      confirmation: {
        type: "redirect",
        return_url: `${this.config.returnUrl}?payment=returned&order=${orderId}`,
      },
      metadata: { order_id: orderId },
    };
  }

  /** Валидирует структуру/return URL/idempotence-key, создаёт платёж и сверяет provider amount/order с неизменяемым запросом. */
  async createPayment(
    rawRequest: unknown,
    key: string,
  ): Promise<YookassaPayment> {
    const parsed = requestSchema.safeParse(rawRequest);
    if (!parsed.success) throw failure();
    const request = parsed.data;
    if (
      !z.uuid().safeParse(key).success ||
      request.confirmation.return_url !==
        `${this.config.returnUrl}?payment=returned&order=${request.metadata.order_id}` ||
      moneyMinor(request.amount.value) === null
    )
      throw failure();
    const payment = this.parsePayment(
      await this.request("payments", { request, key }),
    );
    if (
      payment.amount.value !== request.amount.value ||
      payment.metadata.order_id !== request.metadata.order_id
    )
      throw failure();
    return payment;
  }

  /** Ограничивает четыре конкурентных запроса, 15-секундный fetch и 64 KiB JSON; запрещает redirects и всегда освобождает inFlight. */
  private async request(
    path: string,
    create?: { request: YookassaCreateRequest; key: string },
  ): Promise<unknown> {
    if (this.inFlight >= 4) throw failure();
    this.inFlight++;
    try {
      const response = await fetch(`https://api.yookassa.ru/v3/${path}`, {
        method: create ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.shopId}:${this.config.secretKey}`).toString("base64")}`,
          ...(create
            ? {
                "Content-Type": "application/json",
                "Idempotence-Key": create.key,
              }
            : {}),
        },
        ...(create ? { body: JSON.stringify(create.request) } : {}),
      });
      if (
        !response.ok ||
        !response.body ||
        !response.headers.get("content-type")?.includes("application/json")
      ) {
        await response.body?.cancel();
        throw failure();
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > 64 * 1024) throw failure();
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw failure();
    } finally {
      this.inFlight--;
    }
  }

  /** Проверяет, что credentials действительно принадлежат нужному TEST shopId с доступным способом оплаты. */
  async verifyAccount(): Promise<void> {
    const account = z
      .object({
        account_id: z.literal(this.config.shopId),
        test: z.literal(true),
        payment_methods: z.array(z.string()).min(1),
      })
      .safeParse(await this.request("me"));
    if (!account.success) throw failure();
  }

  /** Читает только проверенный UUID платежа и сверяет его с id ответа провайдера. */
  async getPayment(id: string): Promise<YookassaPayment> {
    if (!paymentIdSchema.safeParse(id).success) throw failure();
    const payment = this.parsePayment(await this.request(`payments/${id}`));
    if (payment.id !== id) throw failure();
    return payment;
  }

  /** Проверяет TEST-платёж по схеме, принадлежности shopId, положительной сумме и безопасной confirmation-ссылке. */
  private parsePayment(raw: unknown): YookassaPayment {
    const payment = paymentSchema.safeParse(raw);
    if (
      !payment.success ||
      payment.data.recipient.account_id !== this.config.shopId ||
      moneyMinor(payment.data.amount.value) === null
    )
      throw failure();
    try {
      confirmationUrl(payment.data);
    } catch {
      throw failure();
    }
    return payment.data;
  }
}
