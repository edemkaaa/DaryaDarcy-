/** Проверяет синтетические диагностические уведомления без выдачи доступа и отправки писем. */
import { timingSafeEqual } from "node:crypto";
import { createProdamusSign } from "./prodamus-signature";
import { buildProdamusQuery } from "./prodamus-query";
import { parseProdamusPayload } from "./prodamus-payload";
import { moneyMinor } from "./protocol";

const merchant = "https://testpage1.payform.ru";
const application = "https://daryadarcy.dev.reeskeen.ru";
const contact = "prodamus-demo@example.test";
const unavailable = "Prodamus sandbox is not configured";
type Configuration = {
  secret: string;
  orderId: string;
  sys: string;
  demoSign: boolean;
};
type DiagnosticStatus =
  | "success"
  | "pending"
  | "order_canceled"
  | "order_denied";
export type SandboxNotification =
  | {
      status: 200;
      body: {
        mode: "demo";
        accessGranted: false;
        notificationVerified: true;
        paymentStatus: DiagnosticStatus;
      };
    }
  | { status: 400 | 503; body: { error: string } };

/** Принимает только явный sandbox, фиксированные test merchant/app origin и проверенные secret/order/sys; неполная или неоднозначная настройка выключает диагностику. */
function configuration(
  env: Record<string, string | undefined>,
): Configuration | null {
  const secret = env.PRODAMUS_SANDBOX_SECRET || "";
  const orderId = env.PRODAMUS_SANDBOX_ORDER_ID || "";
  const sys = env.PRODAMUS_SANDBOX_SYS || "";
  const demoSign = env.PRODAMUS_SANDBOX_DEMO_SIGN;
  if (
    env.PRODAMUS_SANDBOX_ENABLED !== "true" ||
    ![merchant, `${merchant}/`].includes(
      env.PRODAMUS_SANDBOX_PAYFORM_URL || "",
    ) ||
    ![application, `${application}/`].includes(env.PUBLIC_APP_URL || "") ||
    !/^[a-f0-9]{64}$/i.test(secret) ||
    !/^dd-demo-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      orderId,
    ) ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(sys) ||
    (demoSign !== undefined && demoSign !== "false" && demoSign !== "true")
  )
    return null;
  return { secret, orderId, sys, demoSign: demoSign === "true" };
}

/** Только синтетическая диагностика без состояния и портов settlement, identity, БД и почты. */
export class ProdamusSandboxService {
  private readonly config: Configuration | null;
  /** Сохраняет неизменяемый snapshot проверенной sandbox-конфигурации без сетевых и SQL-побочных эффектов. */
  constructor(env: Record<string, string | undefined>) {
    this.config = configuration(env);
  }

  /** Repeated calls reuse the configured diagnostic order; they never create a purchase. */
  /** Пересобирает один configured demo-заказ с фиксированной RUB-суммой и синтетической почтой; возврат ведёт в клуб, но доступ не выдаётся. */
  buildLink(): string {
    if (!this.config) throw new Error(unavailable);
    const payload = {
      do: "pay",
      demo_mode: "1",
      order_id: this.config.orderId,
      customer_email: contact,
      currency: "rub",
      sum: "790.00",
      products: [
        {
          name: "DaryaDarcy demo diagnostic (no access)",
          price: "790.00",
          quantity: "1",
          type: "service",
        },
      ],
      payment_method: "AC",
      installments_disabled: "1",
      payments_limit: "1",
      sys: this.config.sys,
      callbackType: "json",
      urlNotification: `${application}/api/prodamus/sandbox/webhook`,
      // Navigation is intentionally not an access/status signal.
      urlReturn: `${application}/club`,
      urlSuccess: `${application}/club`,
    };
    const key = this.config.demoSign
      ? `${this.config.secret}demo`
      : this.config.secret;
    return `${merchant}/?${buildProdamusQuery({ ...payload, signature: createProdamusSign(payload, key) })}`;
  }

  /** Проверяет raw/signature, затем точные demo/domain/order/sum/contact/status поля и возвращает лишь диагностический статус accessGranted:false. */
  acceptNotification(raw: unknown, signature: unknown): SandboxNotification {
    if (!this.config) return { status: 503, body: { error: unavailable } };
    const invalid: SandboxNotification = {
      status: 400,
      body: { error: "Invalid sandbox notification" },
    };
    if (
      (!Buffer.isBuffer(raw) && typeof raw !== "string") ||
      typeof signature !== "string" ||
      !/^[a-f0-9]{64}$/i.test(signature)
    )
      return invalid;
    const received = Buffer.from(signature, "hex");
    let body: Record<string, unknown>;
    let signed: boolean;
    try {
      body = parseProdamusPayload({}, raw);
      signed = [this.config.secret, `${this.config.secret}demo`].some((key) =>
        timingSafeEqual(
          Buffer.from(createProdamusSign(body, key), "hex"),
          received,
        ),
      );
    } catch {
      // Malformed/deep signature input is a validation error, not a retryable
      // settlement failure. There are no durable effects in this diagnostic.
      return invalid;
    }
    if (!signed) return invalid;
    /** Читает поле диагностического тела только если оно строка; объекты и числа не приводятся неявно. */
    const scalar = (name: string) =>
      typeof body[name] === "string" ? body[name] : "";
    const status = scalar("payment_status");
    const providerId =
      typeof body.order_id === "number" && Number.isSafeInteger(body.order_id)
        ? String(body.order_id)
        : scalar("order_id");
    if (
      (body.demo_mode !== "1" && body.demo_mode !== 1) ||
      Object.keys(body).some(
        (name) =>
          (name.toLowerCase() === "demomode" ||
            name.toLowerCase() === "demo_mode") &&
          name !== "demo_mode",
      ) ||
      Object.keys(body).some((name) => name.toLowerCase() === "subscription") ||
      scalar("domain") !== "testpage1.payform.ru" ||
      scalar("order_num") !== this.config.orderId ||
      !/^[1-9]\d{0,31}$/.test(providerId) ||
      moneyMinor(scalar("sum")) !== 79000 ||
      scalar("currency").toLowerCase() !== "rub" ||
      scalar("customer_email") !== contact ||
      (body.customer_phone !== undefined && body.customer_phone !== "") ||
      (body.payment_init !== undefined && body.payment_init !== "manual") ||
      (status !== "success" &&
        status !== "pending" &&
        status !== "order_canceled" &&
        status !== "order_denied")
    )
      return invalid;
    return {
      status: 200,
      body: {
        mode: "demo",
        accessGranted: false,
        notificationVerified: true,
        paymentStatus: status,
      },
    };
  }
}
