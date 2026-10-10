import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  requestMemberEmailBinding,
  getMemberEmailBinding,
} from "../apps/frontend/src/shared/api/member-email-binding";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";
import { createServer } from "node:http";

const api = vi.hoisted(() => ({ origin: "https://api.example.test" }));
vi.mock("../apps/frontend/src/shared/config/api", () => ({
  apiUrl: (path: string) => api.origin + path,
}));
const key = "940ceec3-f175-4353-a42a-b79c302726dd";
const input = { userId: 201, email: "member@example.test", requestKey: key };
const status = {
  requestKey: key,
  userId: 201,
  state: "pending",
  delivery: "queued",
  expiresAt: "2026-10-11T12:00:00.000Z",
  completedAt: null,
};
let fetcher: ReturnType<typeof vi.fn>;
const signal = () => new AbortController().signal;
const reply = (body: unknown, code = 200) =>
  new Response(JSON.stringify(body), {
    status: code,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cancelSessionRequests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  api.origin = "https://api.example.test";
});

it("sends only the captured intent and does not equate acceptance with confirmation", async () => {
  fetcher.mockResolvedValue(reply({ requestKey: key, state: "pending" }, 202));
  await expect(requestMemberEmailBinding(input, signal())).resolves.toEqual({
    requestKey: key,
    state: "pending",
  });
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    "https://api.example.test/api/admin/member-email-bindings",
    expect.objectContaining({
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
});

it.each(["pending", "confirmed", "expired", "cancelled"])(
  "retains the %s replay outcome without generating a new intent",
  async (state) => {
    fetcher.mockImplementation(() =>
      Promise.resolve(reply({ requestKey: key, state }, 202)),
    );
    await requestMemberEmailBinding(input, signal());
    await expect(requestMemberEmailBinding(input, signal())).resolves.toEqual({
      requestKey: key,
      state,
    });
    expect(fetcher.mock.calls.map((call) => JSON.parse(call[1].body))).toEqual([
      input,
      input,
    ]);
  },
);

it.each(
  [
    {},
    null,
    [],
    { requestKey: key, state: "sent" },
    { requestKey: "another-intent", state: "pending" },
    { requestKey: key, state: "pending", token: "PRIVATE_PROOF" },
  ].map((body) => [body]),
)(
  "refuses an incomplete, mismatched or overbroad receipt: %j",
  async (body) => {
    fetcher.mockResolvedValue(reply(body, 202));
    await expect(
      requestMemberEmailBinding(input, signal()),
    ).rejects.toMatchObject({ kind: "invalid-response" });
  },
);

it.each([200, 201])(
  "does not accept HTTP %i as a request receipt",
  async (code) => {
    fetcher.mockResolvedValue(
      reply({ requestKey: key, state: "pending" }, code),
    );
    await expect(
      requestMemberEmailBinding(input, signal()),
    ).rejects.toMatchObject({ kind: "invalid-response" });
  },
);

it.each(["queued", "sent", "unavailable"])(
  "reads %s delivery separately from identity state",
  async (delivery) => {
    fetcher.mockResolvedValue(reply({ ...status, delivery }));
    await expect(
      getMemberEmailBinding({ userId: 201, requestKey: key }, signal()),
    ).resolves.toEqual({ ...status, delivery });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      `https://api.example.test/api/admin/member-email-bindings/${key}`,
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        credentials: "include",
      }),
    );
  },
);

it.each([
  { userId: 202 },
  { userId: "201" },
  { requestKey: "wrong-key" },
  { delivery: "delivered" },
  { state: "success" },
  { expiresAt: "2026-02-30T12:00:00.000Z" },
  { expiresAt: "2026-10-11" },
  { completedAt: "bad-date" },
  { completedAt: "2026-10-10T12:00:00.000Z" },
  { state: "confirmed" },
  { email: "PRIVATE_EMAIL" },
])(
  "rejects a status that cannot safely describe this member's intent: %j",
  async (change) => {
    fetcher.mockResolvedValue(reply({ ...status, ...change }));
    await expect(
      getMemberEmailBinding({ userId: 201, requestKey: key }, signal()),
    ).rejects.toMatchObject({ kind: "invalid-response" });
  },
);

it.each(["confirmed", "expired", "cancelled"])(
  "accepts complete terminal %s state and past expiry without rewriting it",
  async (state) => {
    const body = {
      ...status,
      state,
      delivery: "sent",
      completedAt: "2026-10-11T13:00:00.000Z",
    };
    fetcher.mockResolvedValue(reply(body));
    await expect(
      getMemberEmailBinding({ userId: 201, requestKey: key }, signal()),
    ).resolves.toEqual(body);
  },
);

it.each([400, 401, 403, 404, 409, 415, 429, 503])(
  "keeps HTTP %i for recovery decisions without reflecting private error text",
  async (code) => {
    fetcher.mockImplementation(() =>
      Promise.resolve(
        new Response("PRIVATE_EMAIL PRIVATE_SQL", {
          status: code,
          headers: { "Retry-After": "120" },
        }),
      ),
    );
    for (const run of [
      () => requestMemberEmailBinding(input, signal()),
      () => getMemberEmailBinding(input, signal()),
    ]) {
      const error = await run().catch((value: unknown) => value);
      expect(error).toMatchObject({ status: code, kind: "http" });
      expect(String(error)).not.toContain("PRIVATE_");
      if (code === 429) expect(error).toMatchObject({ retryAfterSec: 120 });
    }
  },
);

it("does not silently retry an uncertain submission and reuses its key on explicit retry", async () => {
  fetcher.mockRejectedValueOnce(new TypeError("connection lost"));
  await expect(
    requestMemberEmailBinding(input, signal()),
  ).rejects.toMatchObject({ kind: "network" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValue(reply({ requestKey: key, state: "pending" }, 202));
  await requestMemberEmailBinding(input, signal());
  expect(
    fetcher.mock.calls.map((call) => JSON.parse(call[1].body).requestKey),
  ).toEqual([key, key]);
});

it("does not expose a late successful receipt after the session changes", async () => {
  let finish!: (value: unknown) => void;
  fetcher.mockResolvedValue({
    ok: true,
    status: 202,
    json: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const pending = requestMemberEmailBinding(input, signal()).catch(
    (error: unknown) => error,
  );
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  cancelSessionRequests();
  finish({ requestKey: key, state: "confirmed" });
  expect(await pending).toMatchObject({ kind: "cancelled" });
});

it.each([
  { userId: 0 },
  { userId: 2147483648 },
  { userId: 1.5 },
  { requestKey: "../other" },
  { requestKey: key.toUpperCase() },
])(
  "refuses invalid member/intent locally without issuing a request: %j",
  async (change) => {
    await expect(async () =>
      requestMemberEmailBinding({ ...input, ...change }, signal()),
    ).rejects.toMatchObject({ status: 400 });
    await expect(async () =>
      getMemberEmailBinding({ ...input, ...change }, signal()),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it.each([
  "",
  undefined,
  null,
  "invalid",
  "a@b.c\nother",
  "x".repeat(1025),
  `${"a".repeat(310)}@example.test`,
])("refuses an invalid email without an HTTP request", async (email) => {
  await expect(async () =>
    requestMemberEmailBinding({ ...input, email: email as string }, signal()),
  ).rejects.toMatchObject({ status: 400 });
  expect(fetcher).not.toHaveBeenCalled();
});

it("normalizes the email like the server without sending caller authority or extra fields", async () => {
  fetcher.mockResolvedValue(reply({ requestKey: key, state: "pending" }, 202));
  await requestMemberEmailBinding(
    { ...input, email: " MEMBER@Example.test ", actorId: 999 } as typeof input,
    signal(),
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(input);
});

it.each(["request", "status"])(
  "compares a late %s reply with the original captured intent",
  async (operation) => {
    let finish!: (value: unknown) => void;
    const mutable = { ...input };
    fetcher.mockResolvedValue({
      ok: true,
      status: operation === "request" ? 202 : 200,
      json: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const pending =
      operation === "request"
        ? requestMemberEmailBinding(mutable, signal())
        : getMemberEmailBinding(mutable, signal());
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    mutable.requestKey = "3856eec3-f175-4353-a42a-b79c302726dd";
    mutable.userId = 999;
    finish(
      operation === "request" ? { requestKey: key, state: "pending" } : status,
    );
    await expect(pending).resolves.toMatchObject({
      requestKey: key,
      state: "pending",
    });
  },
);

it.each(["request", "status"])(
  "rejects malformed JSON from %s without exposing its body",
  async (operation) => {
    fetcher.mockResolvedValue(
      new Response("PRIVATE_MALFORMED_BODY", {
        status: operation === "request" ? 202 : 200,
      }),
    );
    const pending =
      operation === "request"
        ? requestMemberEmailBinding(input, signal())
        : getMemberEmailBinding(input, signal());
    await expect(pending).rejects.toMatchObject({ kind: "invalid-response" });
  },
);

it("bounds a stalled response body and never resubmits automatically", async () => {
  vi.useFakeTimers();
  fetcher.mockResolvedValue({
    ok: true,
    status: 202,
    json: () => new Promise(() => {}),
  });
  const pending = requestMemberEmailBinding(input, signal()).catch(
    (error: unknown) => error,
  );
  await vi.advanceTimersByTimeAsync(15000);
  expect(await pending).toMatchObject({ kind: "timeout" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("cancels inspection before fetch when its caller is already cancelled", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    getMemberEmailBinding(input, controller.signal),
  ).rejects.toMatchObject({ kind: "cancelled" });
  expect(fetcher).not.toHaveBeenCalled();
});

it("sends and reads the contract through real loopback HTTP without exposing email in the status URL", async () => {
  vi.unstubAllGlobals();
  const requests: { method?: string; url?: string; body: string }[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += String(chunk);
    requests.push({ method: request.method, url: request.url, body });
    response.writeHead(request.method === "POST" ? 202 : 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(
      JSON.stringify(
        request.method === "POST"
          ? { requestKey: key, state: "pending" }
          : status,
      ),
    );
  });
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No loopback listener");
    api.origin = `http://127.0.0.1:${address.port}`;
    await expect(requestMemberEmailBinding(input, signal())).resolves.toEqual({
      requestKey: key,
      state: "pending",
    });
    await expect(getMemberEmailBinding(input, signal())).resolves.toEqual(
      status,
    );
    expect(requests).toEqual([
      {
        method: "POST",
        url: "/api/admin/member-email-bindings",
        body: JSON.stringify(input),
      },
      {
        method: "GET",
        url: `/api/admin/member-email-bindings/${key}`,
        body: "",
      },
    ]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
