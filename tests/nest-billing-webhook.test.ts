import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createHmac } from "node:crypto";
import { request as httpRequest } from "node:http";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import * as prodamus from "../apps/backend/src/prodamus";
import * as db from "../apps/backend/src/db";
import { ClubSettlementService } from "../apps/backend/src/billing/club-settlement.service";
import {
  PRODAMUS_WEBHOOK_HANDLER,
  type ProdamusWebhookHandler,
} from "../apps/backend/src/billing/prodamus-webhook.controller";

let application: INestApplication;
let base: string;
const body =
  "payment_status=pending&subscription[id]=7&subscription[profile_id]=23";
// Independent, hand-derived canonical payload: no production signing helper.
const sign = createHmac("sha256", "nest-webhook-fixture-secret")
  .update(
    '{"payment_status":"pending","subscription":{"id":"7","profile_id":"23"}}',
  )
  .digest("hex");
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PRODAMUS_SECRET", "nest-webhook-fixture-secret");
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_SECRET", "");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "");
  vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru");
  application = await createBackendApplication();
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await application?.close();
  vi.unstubAllEnvs();
});
it.each([
  {
    contentType: "application/json",
    raw: '{"payment_status":"pending","subscription":{"profile_id":"23"}}',
  },
  {
    contentType: "application/x-www-form-urlencoded",
    raw: "payment_status=pending&subscription[profile_id]=23",
  },
])(
  "POST $contentType keeps body precedence in the signed payload",
  async ({ contentType, raw }) => {
    const signature = createHmac("sha256", "nest-webhook-fixture-secret")
      .update(
        '{"note":"query","payment_status":"pending","subscription":{"profile_id":"23"}}',
      )
      .digest("hex");
    const settlement = vi.spyOn(db, "settleClubPayment");
    const response = await fetch(
      base +
        "/api/prodamus/webhook?note=query&payment_status=success&subscription[id]=99",
      {
        method: "POST",
        headers: { "Content-Type": contentType, Sign: signature },
        body: raw,
      },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ignored");
    expect(settlement).not.toHaveBeenCalled();
  },
);
it("rejects an added own JSON __proto__ field before settlement", async () => {
  const settlement = vi.spyOn(db, "settleClubPayment");
  const signature = createHmac("sha256", "nest-webhook-fixture-secret")
    .update('{"payment_status":"pending"}')
    .digest("hex");
  const response = await fetch(base + "/api/prodamus/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", Sign: signature },
    body: '{"payment_status":"pending","__proto__":{"note":"unsigned"}}',
  });
  expect(response.status).toBe(400);
  expect(await response.text()).toBe("signature incorrect");
  expect(settlement).not.toHaveBeenCalled();
});
it.each(["POST", "GET"])(
  "%s webhook uses its application-bound handler, not the legacy runtime global",
  async (method) => {
    // A late runtime-global replacement must not hijack an initialized app.
    vi.spyOn(prodamus, "handleProdamusWebhook").mockImplementation(
      async (_req, res) => {
        res.status(418).send("wrong global handler");
      },
    );
    const response = await fetch(
      base + "/api/prodamus/webhook" + (method === "GET" ? "?" + body : ""),
      {
        method,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Sign: sign,
        },
        ...(method === "POST" ? { body } : {}),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ignored");
  },
);

it("native webhook forwards original bytes beyond the ordinary JSON body limit", async () => {
  const raw = JSON.stringify({ note: "Привет", padding: "x".repeat(300_000) });
  const handler = application.get<ProdamusWebhookHandler>(
    PRODAMUS_WEBHOOK_HANDLER,
  );
  vi.spyOn(handler, "handle").mockImplementation(async (request, response) => {
    expect(request.method).toBe("POST");
    expect(Buffer.isBuffer(request.body)).toBe(true);
    expect(request.body.equals(Buffer.from(raw, "utf8"))).toBe(true);
    expect(request.headers.sign).toBe("synthetic-signature");
    response.status(202).send("injected raw ingress");
  });
  const response = await fetch(base + "/api/prodamus/webhook", {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      Sign: "synthetic-signature",
    },
  });
  expect(response.status).toBe(202);
  expect(await response.text()).toBe("injected raw ingress");
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("oversized webhook is rejected before its handler without leaking bytes", async () => {
  const handler = application.get<ProdamusWebhookHandler>(
    PRODAMUS_WEBHOOK_HANDLER,
  );
  const operation = vi.spyOn(handler, "handle");
  const response = await fetch(base + "/api/prodamus/webhook", {
    method: "POST",
    body: "PRIVATE_OVERSIZE_BODY" + "x".repeat(2 * 1024 * 1024),
    headers: { "Content-Type": "application/json" },
  });
  expect(response.status).toBe(413);
  expect(await response.text()).not.toContain("PRIVATE_OVERSIZE_BODY");
  expect(operation).not.toHaveBeenCalled();
});
it("handler bindings are isolated between application instances", async () => {
  const other = await createBackendApplication();
  try {
    await other.listen(0, "127.0.0.1");
    const otherBase = `http://127.0.0.1:${(other.getHttpServer().address() as AddressInfo).port}`;
    const handler = application.get<ProdamusWebhookHandler>(
      PRODAMUS_WEBHOOK_HANDLER,
    );
    vi.spyOn(handler, "handle").mockImplementation(
      async (_request, response) => {
        response.status(202).send("first application only");
      },
    );
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Sign: sign,
    };
    const first = await fetch(base + "/api/prodamus/webhook", {
      method: "POST",
      headers,
      body,
    });
    expect(first.status).toBe(202);
    const second = await fetch(otherBase + "/api/prodamus/webhook", {
      method: "POST",
      headers,
      body,
    });
    expect(second.status).toBe(200);
    expect(await second.text()).toBe("ignored");
  } finally {
    await other.close();
  }
});

// Sorted scalar fields mirror a real semiannual callback. Canonical JSON is
// hand-derived here, independent of the production normalizer/signing helper.
const payment = {
  currency: "rub",
  customer_email: "member@example.test",
  domain: "fixture.payform.ru",
  order_id: "300155",
  order_num: "club6m-7-confirmed",
  payment_status: "success",
  sum: "4740.00",
};
function notify(payload = payment, key = "nest-webhook-fixture-secret") {
  const raw = JSON.stringify(payload);
  return fetch(base + "/api/prodamus/webhook", {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      Sign: createHmac("sha256", key).update(raw).digest("hex"),
    },
  });
}
it.each([true, false])(
  "signed callback preserves the settlement outcome %s",
  async (granted) => {
    // The real protocol/HTTP handler remains; only the durable SQL boundary is
    // controlled. This does not claim transaction or replay acceptance on MySQL.
    vi.spyOn(db, "settleClubPayment").mockImplementation(async (input) => {
      expect(input).toEqual({
        orderId: "club6m-7-confirmed",
        periodMs: 15_552_000_000,
        sum: "4740.00",
        recurring: undefined,
        proof: {
          domain: "fixture.payform.ru",
          paymentId: "300155",
          email: "member@example.test",
          currency: "rub",
          subscriptionId: "",
          profileId: "",
        },
      });
      return granted;
    });
    const response = await notify();
    expect(response.status).toBe(granted ? 200 : 422);
    expect(await response.text()).toBe(
      granted ? "success" : "payment binding invalid",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  },
);
it("signed legacy field aliases preserve the exact club settlement proof", async () => {
  const raw =
    '{"Currency":"RUB","CustomerEmail":" MEMBER@EXAMPLE.TEST ","Domain":"FIXTURE.PAYFORM.RU","Order_ID":"300155","Order_Num":"club6m-7-alias","PaymentStatus":"SUCCESS","Sum":"4740.00"}';
  vi.spyOn(db, "settleClubPayment").mockImplementation(async (input) => {
    expect(input).toEqual({
      orderId: "club6m-7-alias",
      periodMs: 15_552_000_000,
      sum: "4740.00",
      recurring: undefined,
      proof: {
        domain: "fixture.payform.ru",
        paymentId: "300155",
        email: "member@example.test",
        currency: "RUB",
        subscriptionId: "",
        profileId: "",
      },
    });
    return true;
  });
  // This literal is hand-sorted canonical JSON with only string values/no slashes.
  const response = await fetch(base + "/api/prodamus/webhook", {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      Sign: createHmac("sha256", "nest-webhook-fixture-secret")
        .update(raw)
        .digest("hex"),
    },
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("success");
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("signed monthly payment preserves the nested subscription binding in settlement", async () => {
  const raw =
    '{"currency":"RUB","customer_email":" MEMBER+CLUB@EXAMPLE.TEST ","domain":"FIXTURE.PAYFORM.RU","order_id":"300156","order_num":"club-7-monthly","payment_status":"success","subscription":{"id":"7","profile_id":"23"},"sum":"790.00"}';
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "7");
  const settle = vi
    .spyOn(db, "settleClubPayment")
    .mockImplementation(async (input) => {
      expect(input).toEqual({
        orderId: "club-7-monthly",
        periodMs: 2_592_000_000,
        sum: "790.00",
        recurring: undefined,
        proof: {
          domain: "fixture.payform.ru",
          paymentId: "300156",
          email: "member+club@example.test",
          currency: "RUB",
          subscriptionId: "7",
          profileId: "23",
        },
      });
      return true;
    });
  try {
    const response = await fetch(base + "/api/prodamus/webhook", {
      method: "POST",
      body: raw,
      headers: {
        "Content-Type": "application/json",
        Sign: createHmac("sha256", "nest-webhook-fixture-secret")
          .update(raw)
          .digest("hex"),
      },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("success");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(settle).toHaveBeenCalledTimes(1);
  } finally {
    vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "");
  }
});
it("a valid signature from another merchant cannot reach settlement", async () => {
  const settle = vi.spyOn(db, "settleClubPayment").mockResolvedValue(true);
  const response = await notify({ ...payment, domain: "another.payform.ru" });
  expect(response.status).toBe(422);
  expect(await response.text()).toBe("payment binding invalid");
  expect(settle).not.toHaveBeenCalled();
});
it("club acknowledgement follows the application-bound settlement decision", async () => {
  // A hidden/global settlement path would return success instead of this rejection.
  const database = vi.spyOn(db, "settleClubPayment").mockResolvedValue(true);
  const service = application.get(ClubSettlementService);
  const operation = vi
    .spyOn(service, "settle")
    .mockImplementation(async (orderId, details) => {
      expect(orderId).toBe("club6m-7-confirmed");
      expect(details?.sum).toBe("4740.00");
      expect(details?.proof).toEqual({
        domain: "fixture.payform.ru",
        paymentId: "300155",
        email: "member@example.test",
        currency: "rub",
        subscriptionId: "",
        profileId: "",
      });
      return false;
    });
  const response = await notify();
  expect(response.status).toBe(422);
  expect(await response.text()).toBe("payment binding invalid");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(operation).toHaveBeenCalledTimes(1);
  expect(database).not.toHaveBeenCalled();
});
it("recurring acknowledgement uses the same application-bound settlement service", async () => {
  const raw =
    '{"currency":"rub","customer_email":"member@example.test","domain":"fixture.payform.ru","order_id":"300157","payment_status":"success","subscription":{"action_code":"auto_payment","id":"7","profile_id":"23"},"sum":"790.00"}';
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "7");
  const database = vi.spyOn(db, "settleClubPayment").mockResolvedValue(true);
  const operation = vi
    .spyOn(application.get(ClubSettlementService), "settle")
    .mockImplementation(async (orderId, details) => {
      expect(orderId).toBe("club-renew");
      expect(details).toEqual({
        email: "member@example.test",
        sum: "790.00",
        recurring: true,
        proof: {
          domain: "fixture.payform.ru",
          paymentId: "300157",
          email: "member@example.test",
          currency: "rub",
          subscriptionId: "7",
          profileId: "23",
        },
      });
      return false;
    });
  try {
    const response = await fetch(base + "/api/prodamus/webhook", {
      method: "POST",
      body: raw,
      headers: {
        "Content-Type": "application/json",
        Sign: createHmac("sha256", "nest-webhook-fixture-secret")
          .update(raw)
          .digest("hex"),
      },
    });
    expect(response.status).toBe(422);
    expect(await response.text()).toBe("payment binding invalid");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(operation).toHaveBeenCalledTimes(1);
    expect(database).not.toHaveBeenCalled();
  } finally {
    vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "");
  }
});
it("settlement decisions remain isolated between native application instances", async () => {
  const other = await createBackendApplication();
  const database = vi.spyOn(db, "settleClubPayment").mockResolvedValue(true);
  const firstOperation = vi
    .spyOn(application.get(ClubSettlementService), "settle")
    .mockResolvedValue(false);
  const secondOperation = vi
    .spyOn(other.get(ClubSettlementService), "settle")
    .mockResolvedValue(true);
  try {
    await other.listen(0, "127.0.0.1");
    const otherBase = `http://127.0.0.1:${(other.getHttpServer().address() as AddressInfo).port}`;
    const first = await notify();
    const raw = JSON.stringify(payment);
    const second = await fetch(otherBase + "/api/prodamus/webhook", {
      method: "POST",
      body: raw,
      headers: {
        "Content-Type": "application/json",
        Sign: createHmac("sha256", "nest-webhook-fixture-secret")
          .update(raw)
          .digest("hex"),
      },
    });
    expect(first.status).toBe(422);
    expect(await first.text()).toBe("payment binding invalid");
    expect(second.status).toBe(200);
    expect(await second.text()).toBe("success");
    expect(firstOperation).toHaveBeenCalledTimes(1);
    expect(secondOperation).toHaveBeenCalledTimes(1);
    expect(database).not.toHaveBeenCalled();
  } finally {
    await other.close();
  }
});
it.each([
  [
    "wrong currency",
    '{"currency":"USD","customer_email":"member@example.test","domain":"fixture.payform.ru","order_id":"300156","order_num":"club-7-monthly","payment_status":"success","subscription":{"id":"7","profile_id":"23"},"sum":"790.00"}',
  ],
  [
    "missing provider payment ID",
    '{"currency":"rub","customer_email":"member@example.test","domain":"fixture.payform.ru","order_num":"club-7-monthly","payment_status":"success","subscription":{"id":"7","profile_id":"23"},"sum":"790.00"}',
  ],
  [
    "another subscription",
    '{"currency":"rub","customer_email":"member@example.test","domain":"fixture.payform.ru","order_id":"300156","order_num":"club-7-monthly","payment_status":"success","subscription":{"id":"8","profile_id":"23"},"sum":"790.00"}',
  ],
  [
    "missing monthly subscription",
    '{"currency":"rub","customer_email":"member@example.test","domain":"fixture.payform.ru","order_id":"300156","order_num":"club-7-monthly","payment_status":"success","sum":"790.00"}',
  ],
  [
    "missing subscription profile",
    '{"currency":"rub","customer_email":"member@example.test","domain":"fixture.payform.ru","order_id":"300156","order_num":"club-7-monthly","payment_status":"success","subscription":{"id":"7"},"sum":"790.00"}',
  ],
  [
    "non-numeric subscription profile",
    '{"currency":"rub","customer_email":"member@example.test","domain":"fixture.payform.ru","order_id":"300156","order_num":"club-7-monthly","payment_status":"success","subscription":{"id":"7","profile_id":"wrong"},"sum":"790.00"}',
  ],
])(
  "signed club payment with %s cannot reach settlement",
  async (_name, raw) => {
    // Hand-sorted string-only canonical JSON: independent of production signing.
    vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "7");
    const settle = vi.spyOn(db, "settleClubPayment").mockResolvedValue(true);
    const operation = vi.spyOn(
      application.get(ClubSettlementService),
      "settle",
    );
    try {
      const response = await fetch(base + "/api/prodamus/webhook", {
        method: "POST",
        body: raw,
        headers: {
          "Content-Type": "application/json",
          Sign: createHmac("sha256", "nest-webhook-fixture-secret")
            .update(raw)
            .digest("hex"),
        },
      });
      expect(response.status).toBe(422);
      expect(await response.text()).toBe("payment binding invalid");
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(settle).not.toHaveBeenCalled();
      expect(operation).not.toHaveBeenCalled();
    } finally {
      vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "");
    }
  },
);
it("invalid signatures cannot reach settlement", async () => {
  const settle = vi.spyOn(db, "settleClubPayment");
  const operation = vi.spyOn(application.get(ClubSettlementService), "settle");
  const response = await notify(payment, "wrong-merchant-key");
  expect(response.status).toBe(400);
  expect(await response.text()).toBe("signature incorrect");
  expect(settle).not.toHaveBeenCalled();
  expect(operation).not.toHaveBeenCalled();
});
it("database failure remains a safe 500 instead of acknowledging payment", async () => {
  vi.spyOn(db, "settleClubPayment").mockRejectedValue(
    new Error("PRIVATE_SQL_DETAIL"),
  );
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await notify();
  expect(response.status).toBe(500);
  expect(await response.text()).toBe("error");
  expect(error.mock.calls.flat().join(" ")).not.toContain("PRIVATE_SQL_DETAIL");
});

it.each([
  ["GET", "application/json", "{PRIVATE_INVALID_GET_BODY"],
  ["GET", "application/x-www-form-urlencoded", "payment_status=success"],
  ["HEAD", "application/json", "{PRIVATE_INVALID_GET_BODY"],
  ["HEAD", "application/x-www-form-urlencoded", "payment_status=success"],
])(
  "%s webhook retains query-only parsing with a %s body",
  async (method, contentType, raw) => {
    // fetch forbids GET bodies, but provider clients can send one. The legacy
    // ingress ignores it; generic body parsing must not change signed query data.
    const result = await new Promise<{
      status: number | undefined;
      body: string;
    }>((resolve, reject) => {
      const request = httpRequest(
        base + "/api/prodamus/webhook?" + body,
        {
          method,
          headers: {
            "Content-Type": contentType,
            "Content-Length": Buffer.byteLength(raw),
            Sign: sign,
          },
        },
        (response) => {
          let text = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            text += chunk;
          });
          response.on("end", () =>
            resolve({ status: response.statusCode, body: text }),
          );
          response.on("error", reject);
        },
      );
      request.on("error", reject);
      request.setTimeout(3_000, () =>
        request.destroy(new Error("Loopback request timed out")),
      );
      request.end(raw);
    });
    expect(result).toEqual({
      status: 200,
      body: method === "GET" ? "ignored" : "",
    });
  },
);
