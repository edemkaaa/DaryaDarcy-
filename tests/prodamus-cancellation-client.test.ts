import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { cancelProdamusProfile } from "../apps/backend/src/billing/prodamus-cancellation-client";

const profile = Object.freeze({
  domain: "fixture.payform.ru",
  subscriptionId: "7",
  profileId: "23",
});
const config = Object.freeze({
  payformUrl: "https://fixture.payform.ru",
  subscriptionId: "7",
  secret: "synthetic-client-fixture",
  production: true,
});
afterEach(() => vi.restoreAllMocks());

it.each([false, true])(
  "sends exactly the signed manager=%s cancellation to the configured endpoint",
  async (manager) => {
    const send = vi.fn<typeof fetch>(async (url, init) => {
      const canonical = manager
        ? '{"active_manager":"0","profile":"23","subscription":"7"}'
        : '{"active_user":"0","profile":"23","subscription":"7"}';
      const signature = createHmac("sha256", "synthetic-client-fixture")
        .update(canonical)
        .digest("hex");
      expect(url).toBe("https://fixture.payform.ru/rest/setActivity/");
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("error");
      expect(init?.headers).toEqual({
        "Content-Type": "application/x-www-form-urlencoded",
      });
      expect(init?.body).toBe(
        `subscription=7&profile=23&active_${manager ? "manager" : "user"}=0&signature=${signature}`,
      );
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("  success\n");
    });
    expect(
      await cancelProdamusProfile({ ...profile, manager }, config, send),
    ).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  },
);

it.each([
  { domain: "other.payform.ru" },
  { subscriptionId: "8" },
  { subscriptionId: "" },
  { profileId: "" },
])("refuses an unmatched profile without a request: %j", async (fields) => {
  const send = vi.fn<typeof fetch>();
  expect(
    await cancelProdamusProfile({ ...profile, ...fields }, config, send),
  ).toBe(false);
  expect(send).not.toHaveBeenCalled();
});

it("refuses a missing secret before transport", async () => {
  const send = vi.fn<typeof fetch>();
  expect(
    await cancelProdamusProfile(profile, { ...config, secret: "" }, send),
  ).toBe(false);
  expect(send).not.toHaveBeenCalled();
});

it.each([
  {
    url: "http://fixture.payform.ru",
    domain: "fixture.payform.ru",
    production: false,
    want: false,
  },
  {
    url: "http://localhost",
    domain: "localhost",
    production: true,
    want: false,
  },
  {
    url: "http://127.0.0.1",
    domain: "127.0.0.1",
    production: true,
    want: false,
  },
  {
    url: "http://localhost",
    domain: "localhost",
    production: false,
    want: true,
  },
  {
    url: "http://127.0.0.1",
    domain: "127.0.0.1",
    production: false,
    want: true,
  },
])(
  "preserves trusted endpoint restriction: $url / production=$production",
  async (fixture) => {
    const send = vi.fn<typeof fetch>(async (url) => {
      expect(url).toBe(fixture.url + "/rest/setActivity/");
      return new Response("success");
    });
    expect(
      await cancelProdamusProfile(
        { ...profile, domain: fixture.domain },
        { ...config, payformUrl: fixture.url, production: fixture.production },
        send,
      ),
    ).toBe(fixture.want);
    expect(send).toHaveBeenCalledTimes(fixture.want ? 1 : 0);
  },
);

it("does not send a profile when configured subscription is missing", async () => {
  const send = vi.fn<typeof fetch>();
  expect(
    await cancelProdamusProfile(
      profile,
      { ...config, subscriptionId: "" },
      send,
    ),
  ).toBe(false);
  expect(send).not.toHaveBeenCalled();
});

it("preserves rejection of a malformed configured URL before transport", async () => {
  const send = vi.fn<typeof fetch>();
  await expect(
    cancelProdamusProfile(
      profile,
      { ...config, payformUrl: "not-a-url" },
      send,
    ),
  ).rejects.toBeInstanceOf(TypeError);
  expect(send).not.toHaveBeenCalled();
});

it("does not confirm or expose private transport errors", async () => {
  const send = vi.fn<typeof fetch>(async () => {
    throw new Error("PRIVATE_PROVIDER_DETAIL");
  });
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await cancelProdamusProfile(profile, config, send)).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
  expect(warning).toHaveBeenCalledExactlyOnceWith(
    "[prodamus] setActivity failed",
  );
});
