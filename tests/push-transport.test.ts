/** Push transport проверяет принятие provider tickets, не доставку на устройство; fetch и audience store синтетические. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpoPushMessage } from "../apps/backend/src/push";

const audience = vi.hoisted(() => ({ allowed: [] as string[] }));
vi.mock("../apps/backend/src/db", () => ({
  getMarketingPushTokens: async () => audience.allowed,
  getServicePushTokens: async () => audience.allowed,
}));
import { sendExpoPushBatch } from "../apps/backend/src/push";

let outbound: ExpoPushMessage[][];
let responses: Array<Response | Error>;
/** Создаём узнаваемые локальные токены и сообщения для проверки фильтрации/разбиения. */
function messages(count = 2): ExpoPushMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    to: `ExponentPushToken[fixture-${index}]`,
    sound: "default",
    title: "Fixture",
    body: "Fixture notification",
  }));
}
/** Очищаем очередь ответов, перехватываем только фиксированный Expo endpoint и считаем исходящие пакеты. */
beforeEach(() => {
  outbound = [];
  responses = [];
  audience.allowed = messages().map(message => message.to);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // Only the external HTTP transport and recipient store are replaced; the
  // application filtering, batching, parsing and success count remain real.
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    if (url !== "https://exp.host/--/api/v2/push/send") throw new Error("Unexpected endpoint");
    const batch = JSON.parse(String(options.body)) as ExpoPushMessage[];
    outbound.push(batch);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response ?? Response.json({
      data: batch.map((_message, index) => ({ status: "ok", id: `fixture-receipt-${index}` })),
    });
  });
});
/** Возвращаем fetch и console spies. */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Ни один положительный ticket не считается доказательством появления уведомления на телефоне. */
describe("push provider acceptance, not device delivery", () => {
  /** Корректный ACK каждой отправленной записи увеличивает счётчик принятых. */
  it("counts valid provider tickets", async () => {
    expect(await sendExpoPushBatch("marketing", messages())).toBe(2);
  });
  /** HTTP400/429/503 дают ноль принятых сообщений. */
  it.each([400, 429, 503])("does not count HTTP %s as accepted", async status => {
    responses.push(Response.json({ errors: [{ code: "fixture-error" }] }, { status }));
    expect(await sendExpoPushBatch("marketing", messages())).toBe(0);
  });
  /** Сетевое исключение не считается provider acceptance. */
  it("does not count a transport failure as accepted", async () => {
    responses.push(new Error("fixture transport failure"));
    expect(await sendExpoPushBatch("service", messages())).toBe(0);
  });
  /** Смешанный batch учитывает только ticket ok с ID. */
  it("counts only successful tickets in a partially rejected batch", async () => {
    responses.push(Response.json({ data: [
      { status: "error", message: "fixture rejection", details: { error: "DeviceNotRegistered" } },
      { status: "ok", id: "fixture-accepted" },
    ] }));
    expect(await sendExpoPushBatch("marketing", messages())).toBe(1);
  });
  /** Неполные, неверные и противоречащие batch errors payload не подтверждают отправку. */
  it.each([
    null,
    {},
    { data: [{ status: "ok", id: "fixture-one-ticket-only" }] },
    { data: [{ status: "ok" }, { status: "ok" }] },
    { data: [{ status: "unknown" }, { status: "unknown" }] },
    { data: [{ status: "ok", id: "fixture-id" }, { status: "ok", id: "fixture-id-2" }], errors: [{ code: "fixture-batch-error" }] },
  ])("does not trust malformed or contradictory ticket responses %#", async payload => {
    responses.push(Response.json(payload));
    expect(await sendExpoPushBatch("marketing", messages())).toBe(0);
  });
  /** HTTP200 с нечитаемым JSON не становится успехом. */
  it("does not count an unreadable JSON response", async () => {
    responses.push(new Response("not JSON", { status: 200 }));
    expect(await sendExpoPushBatch("marketing", messages())).toBe(0);
  });
  /** Отказ первых100 не мешает следующим100+5 и не порождает автоматический retry. */
  it("keeps later 100-message batches working after an earlier rejection", async () => {
    const input = messages(205);
    audience.allowed = input.map(message => message.to);
    responses.push(Response.json({ errors: [{ code: "fixture-unavailable" }] }, { status: 503 }));
    expect(await sendExpoPushBatch("marketing", input)).toBe(105);
    expect(outbound.map(batch => batch.length)).toEqual([100, 100, 5]);
  });
  /** Повторный audience filter исключает отозванный токен для service и marketing. */
  it.each(["marketing", "service"] as const)("never submits a token outside the %s audience", async category => {
    audience.allowed = [messages()[0].to];
    expect(await sendExpoPushBatch(category, messages())).toBe(1);
    expect(outbound.flat().map(message => message.to)).toEqual(["ExponentPushToken[fixture-0]"]);
  });
  /** Пустой разрешённый набор не отправляет HTTP. */
  it("makes no transport request for an empty or entirely excluded audience", async () => {
    audience.allowed = [];
    expect(await sendExpoPushBatch("marketing", [])).toBe(0);
    expect(await sendExpoPushBatch("marketing", messages())).toBe(0);
    expect(outbound).toEqual([]);
  });
});
