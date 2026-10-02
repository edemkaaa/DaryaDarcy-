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
function messages(count = 2): ExpoPushMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    to: `ExponentPushToken[fixture-${index}]`,
    sound: "default",
    title: "Fixture",
    body: "Fixture notification",
  }));
}
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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("push provider acceptance, not device delivery", () => {
  it("counts valid provider tickets", async () => {
    expect(await sendExpoPushBatch("marketing", messages())).toBe(2);
  });
  it.each([400, 429, 503])("does not count HTTP %s as accepted", async status => {
    responses.push(Response.json({ errors: [{ code: "fixture-error" }] }, { status }));
    expect(await sendExpoPushBatch("marketing", messages())).toBe(0);
  });
  it("does not count a transport failure as accepted", async () => {
    responses.push(new Error("fixture transport failure"));
    expect(await sendExpoPushBatch("service", messages())).toBe(0);
  });
  it("counts only successful tickets in a partially rejected batch", async () => {
    responses.push(Response.json({ data: [
      { status: "error", message: "fixture rejection", details: { error: "DeviceNotRegistered" } },
      { status: "ok", id: "fixture-accepted" },
    ] }));
    expect(await sendExpoPushBatch("marketing", messages())).toBe(1);
  });
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
  it("does not count an unreadable JSON response", async () => {
    responses.push(new Response("not JSON", { status: 200 }));
    expect(await sendExpoPushBatch("marketing", messages())).toBe(0);
  });
  it("keeps later 100-message batches working after an earlier rejection", async () => {
    const input = messages(205);
    audience.allowed = input.map(message => message.to);
    responses.push(Response.json({ errors: [{ code: "fixture-unavailable" }] }, { status: 503 }));
    expect(await sendExpoPushBatch("marketing", input)).toBe(105);
    expect(outbound.map(batch => batch.length)).toEqual([100, 100, 5]);
  });
  it.each(["marketing", "service"] as const)("never submits a token outside the %s audience", async category => {
    audience.allowed = [messages()[0].to];
    expect(await sendExpoPushBatch(category, messages())).toBe(1);
    expect(outbound.flat().map(message => message.to)).toEqual(["ExponentPushToken[fixture-0]"]);
  });
  it("makes no transport request for an empty or entirely excluded audience", async () => {
    audience.allowed = [];
    expect(await sendExpoPushBatch("marketing", [])).toBe(0);
    expect(await sendExpoPushBatch("marketing", messages())).toBe(0);
    expect(outbound).toEqual([]);
  });
});
